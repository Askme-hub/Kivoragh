// Server-only Moolre disbursement client for Cloudflare Workers.
// HTTPS API traffic is tunneled through Fixie's standard HTTP proxy (FIXIE_URL).
// This avoids spending the separate, smaller SOCKS5 allowance.

type CloudflareSocket = {
  opened: Promise<unknown>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls(options: { expectedServerHostname: string }): CloudflareSocket;
  close(): Promise<void>;
};

type MoolreReply = {
  status?: number | string;
  code?: string;
  message?: string | string[] | null;
  data?: any;
  error?: { message?: string };
};

function payoutConfig() {
  const proxyValue = process.env.FIXIE_URL;
  const user = process.env.MOOLRE_API_USER;
  const key = process.env.MOOLRE_API_KEY;
  const account = process.env.MOOLRE_ACCOUNT_NUMBER;
  if (!proxyValue || !user || !key || !account) {
    throw new Error("Moolre payouts need FIXIE_URL and the Moolre credentials configured.");
  }

  const proxy = new URL(proxyValue);
  if (proxy.protocol !== "http:" || !proxy.hostname || !proxy.username || !proxy.password) {
    throw new Error("FIXIE_URL must be the standard http:// Fixie proxy URL with its username and password.");
  }
  return { proxy, user, key, account };
}

function joinBytes(chunks: Uint8Array[]) {
  const size = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

class SocketByteReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffered = new Uint8Array(0);

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readExactly(length: number) {
    while (this.buffered.length < length) {
      const { value, done } = await this.reader.read();
      if (done || !value) throw new Error("The proxy closed the connection unexpectedly.");
      this.buffered = joinBytes([this.buffered, value]);
    }
    const result = this.buffered.slice(0, length);
    this.buffered = this.buffered.slice(length);
    return result;
  }

  async readUntil(delimiter: string, maxBytes = 16_384) {
    const marker = new TextEncoder().encode(delimiter);
    while (this.buffered.length <= maxBytes) {
      for (let i = 0; i <= this.buffered.length - marker.length; i++) {
        let matches = true;
        for (let j = 0; j < marker.length; j++) {
          if (this.buffered[i + j] !== marker[j]) { matches = false; break; }
        }
        if (matches) {
          const result = this.buffered.slice(0, i);
          this.buffered = this.buffered.slice(i + marker.length);
          return result;
        }
      }
      const { value, done } = await this.reader.read();
      if (done || !value) throw new Error("The proxy closed before completing its response headers.");
      this.buffered = joinBytes([this.buffered, value]);
    }
    throw new Error("The proxy response headers exceeded the allowed size.");
  }

  async readToEnd(maxBytes = 262_144) {
    const chunks = this.buffered.length ? [this.buffered] : [];
    let total = this.buffered.length;
    this.buffered = new Uint8Array(0);
    while (total < maxBytes) {
      const { value, done } = await this.reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.length;
    }
    if (total >= maxBytes) throw new Error("Moolre response exceeded the allowed size.");
    return joinBytes(chunks);
  }

  release() {
    if (this.buffered.length) throw new Error("Unexpected extra data while establishing the proxy tunnel.");
    this.reader.releaseLock();
  }
}

async function establishHttpConnectTunnel(socket: CloudflareSocket, proxy: URL) {
  const writer = socket.writable.getWriter();
  const reader = new SocketByteReader(socket.readable);
  try {
    const credentials = base64Utf8(
      decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password),
    );
    const connectRequest = [
      "CONNECT api.moolre.com:443 HTTP/1.1",
      "Host: api.moolre.com:443",
      "Proxy-Authorization: Basic " + credentials,
      "Proxy-Connection: Keep-Alive",
      "",
      "",
    ].join("\r\n");

    await writer.write(new TextEncoder().encode(connectRequest));
    const headerBytes = await reader.readUntil("\r\n\r\n");
    const header = new TextDecoder().decode(headerBytes);
    const statusLine = header.split("\r\n", 1)[0] ?? "";
    const status = Number(statusLine.split(" ")[1]);

    if (status !== 200) {
      if (status === 407) throw new Error("Fixie rejected the HTTP proxy credentials (HTTP 407). Check the FIXIE_URL secret.");
      throw new Error("Fixie could not establish the HTTPS tunnel (proxy HTTP " + (status || "unknown") + ").");
    }
    reader.release();
  } finally {
    writer.releaseLock();
  }
}

async function readHttpResponse(reader: SocketByteReader) {
  const raw = new TextDecoder().decode(await reader.readToEnd());
  const splitAt = raw.indexOf("\r\n\r\n");
  if (splitAt < 0) {
    const preview = raw.slice(0, 160).replace(/[^\x20-\x7E]/g, ".");
    throw new Error(
      "Moolre returned an incomplete HTTP response (received " + raw.length +
      " bytes; response begins: \"" + (preview || "empty") + "\").",
    );
  }
  const header = raw.slice(0, splitAt);
  let body = raw.slice(splitAt + 4);
  const statusLine = header.split("\r\n", 1)[0] ?? "";
  const status = Number(statusLine.split(" ")[1]);
  if (!Number.isFinite(status)) throw new Error("Moolre returned an invalid HTTP status.");

  if (/\r\ntransfer-encoding:\s*chunked/i.test(header)) {
    const decoded: string[] = [];
    let rest = body;
    while (rest.length) {
      const lineEnd = rest.indexOf("\r\n");
      if (lineEnd < 0) break;
      const size = Number.parseInt(rest.slice(0, lineEnd).split(";", 1)[0] ?? "", 16);
      if (!Number.isFinite(size) || size <= 0) break;
      const start = lineEnd + 2;
      if (rest.length < start + size + 2) break;
      decoded.push(rest.slice(start, start + size));
      rest = rest.slice(start + size + 2);
    }
    body = decoded.join("");
  }

  let json: MoolreReply;
  try {
    json = JSON.parse(body) as MoolreReply;
  } catch {
    throw new Error("Moolre returned an unreadable response (HTTP " + status + ").");
  }
  if (status >= 500) throw new Error("Moolre is temporarily unavailable (HTTP " + status + ").");
  return json;
}

/** Make an HTTPS request through the authenticated Fixie HTTP CONNECT proxy. */
export async function moolrePayoutRequest(
  path: "/open/transact/validate" | "/open/transact/transfer" | "/open/transact/status" | "/open/account/status",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MoolreReply> {
  const { proxy, user, key, account } = payoutConfig();
  const { connect } = await import("cloudflare:sockets");
  let socket: CloudflareSocket | undefined;

  try {
    try {
      socket = connect(
        { hostname: proxy.hostname, port: Number(proxy.port) || 80 },
        { secureTransport: "starttls", allowHalfOpen: true },
      ) as CloudflareSocket;
      await socket.opened;
    } catch {
      throw new Error("Could not open a TCP connection to the Fixie HTTP proxy.");
    }

    try {
      await establishHttpConnectTunnel(socket, proxy);
    } catch (error) {
      throw new Error("Fixie HTTP proxy tunnel failed: " + (error instanceof Error ? error.message : "unknown proxy error"));
    }

    let secureSocket: CloudflareSocket;
    try {
      secureSocket = socket.startTls({ expectedServerHostname: "api.moolre.com" });
      socket = secureSocket;
      await secureSocket.opened;
    } catch {
      throw new Error("The HTTPS/TLS handshake with Moolre failed after the Fixie tunnel was established.");
    }

    const headers = [
      "POST " + path + " HTTP/1.1",
      "Host: api.moolre.com",
      "Content-Type: application/json",
      "Accept: application/json",
      "Accept-Encoding: identity",
      "Connection: close",
      "X-API-USER: " + user,
      "X-API-KEY: " + key,
      ...(idempotencyKey ? ["Idempotency-Key: " + idempotencyKey] : []),
    ];
    const payload = JSON.stringify({ ...body, accountnumber: account });
    const request = headers.join("\r\n") +
      "\r\nContent-Length: " + new TextEncoder().encode(payload).length +
      "\r\n\r\n" + payload;

    try {
      const writer = secureSocket.writable.getWriter();
      await writer.write(new TextEncoder().encode(request));
      writer.releaseLock();

      const reader = new SocketByteReader(secureSocket.readable);
      return await readHttpResponse(reader);
    } catch (error) {
      if (error instanceof Error && error.message.includes("incomplete HTTP response")) throw error;
      throw new Error("The HTTPS request reached the Moolre tunnel, but its response could not be read: " +
        (error instanceof Error ? error.message : "unknown response error"));
    }
  } finally {
    if (socket) await socket.close().catch(() => undefined);
  }
}

export function moolreChannelForProvider(provider: string | null | undefined) {
  switch (provider) {
    case "MTN Mobile Money": return "1";
    case "Telecel Cash": return "6";
    case "AT Money": return "7";
    default: return null;
  }
}

export function normalizeMoolreName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
