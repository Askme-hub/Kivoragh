// Server-only Moolre disbursement client for Cloudflare Workers.
// Fixie SOCKS5 uses port 1080, allowing a secure TLS tunnel to Moolre from a static IP.
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
  const proxyValue = process.env.FIXIE_SOCKS_URL || process.env.FIXIE_SOCKS_HOST;
  const user = process.env.MOOLRE_API_USER;
  const key = process.env.MOOLRE_API_KEY;
  const account = process.env.MOOLRE_ACCOUNT_NUMBER;
  if (!proxyValue || !user || !key || !account) {
    throw new Error("Moolre seller payouts need the Fixie SOCKS URL and Moolre credentials configured.");
  }
  const proxy = new URL(proxyValue.includes("://") ? proxyValue : `socks5://${proxyValue}`);
  if (!["socks5:", "socks5h:"].includes(proxy.protocol) || !proxy.hostname || !proxy.username || !proxy.password) {
    throw new Error("The Fixie SOCKS5 URL is invalid. It must use socks5:// with its username and password.");
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

class SocketByteReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffered = new Uint8Array(0);

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readExactly(length: number) {
    while (this.buffered.length < length) {
      const { value, done } = await this.reader.read();
      if (done || !value) throw new Error("Fixie closed the SOCKS connection unexpectedly.");
      this.buffered = joinBytes([this.buffered, value]);
    }
    const result = this.buffered.slice(0, length);
    this.buffered = this.buffered.slice(length);
    return result;
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
    if (this.buffered.length) throw new Error("Unexpected extra data during the Fixie SOCKS handshake.");
    this.reader.releaseLock();
  }
}

async function readHttpResponse(reader: SocketByteReader) {
  const raw = new TextDecoder().decode(await reader.readToEnd());
  const splitAt = raw.indexOf("\r\n\r\n");
  if (splitAt < 0) {
    const preview = raw.slice(0, 160).replace(/[^\\x20-\\x7E]/g, ".");
    throw new Error(
      `Moolre returned an incomplete HTTP response (received ${raw.length} bytes; response begins: "${preview || "empty"}").`,
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
    throw new Error(`Moolre returned an unreadable response (HTTP ${status}).`);
  }
  if (status >= 500) throw new Error("Moolre is temporarily unavailable.");
  return json;
}

async function establishSocksTunnel(socket: CloudflareSocket, targetHost: string, targetPort: number, username: string, password: string) {
  const writer = socket.writable.getWriter();
  const reader = new SocketByteReader(socket.readable);
  const enc = new TextEncoder();

  // Negotiate SOCKS5 username/password authentication (RFC 1929).
  await writer.write(new Uint8Array([0x05, 0x01, 0x02]));
  const method = await reader.readExactly(2);
  if (method[0] !== 0x05 || method[1] !== 0x02) {
    throw new Error("Fixie SOCKS5 did not accept username/password authentication.");
  }

  const u = enc.encode(decodeURIComponent(username));
  const p = enc.encode(decodeURIComponent(password));
  if (u.length > 255 || p.length > 255) throw new Error("Fixie SOCKS credentials are invalid.");
  await writer.write(joinBytes([new Uint8Array([0x01, u.length]), u, new Uint8Array([p.length]), p]));
  const auth = await reader.readExactly(2);
  if (auth[0] !== 0x01 || auth[1] !== 0x00) throw new Error("Fixie SOCKS5 authentication failed.");

  // Send CONNECT using a domain name so DNS resolution also happens via Fixie.
  const host = enc.encode(targetHost);
  if (host.length > 255) throw new Error("Moolre hostname is invalid.");
  await writer.write(joinBytes([
    new Uint8Array([0x05, 0x01, 0x00, 0x03, host.length]),
    host,
    new Uint8Array([(targetPort >> 8) & 0xff, targetPort & 0xff]),
  ]));
  const response = await reader.readExactly(4);
  if (response[0] !== 0x05 || response[1] !== 0x00) {
    throw new Error(`Fixie SOCKS5 could not connect to Moolre (reply ${response[1]}).`);
  }

  const atyp = response[3];
  if (atyp === 0x01) await reader.readExactly(6);
  else if (atyp === 0x04) await reader.readExactly(18);
  else if (atyp === 0x03) {
    const length = await reader.readExactly(1);
    await reader.readExactly(length[0] + 2);
  } else {
    throw new Error("Fixie SOCKS5 returned an invalid address type.");
  }

  reader.release();
  await writer.releaseLock();
}

/** Make an HTTPS request through the authenticated Fixie SOCKS5 proxy. */
export async function moolrePayoutRequest(
  path: "/open/transact/validate" | "/open/transact/transfer" | "/open/transact/status",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MoolreReply> {
  const { proxy, user, key, account } = payoutConfig();
  const { connect } = await import("cloudflare:sockets");
  let socket: CloudflareSocket | undefined;
  try {
    socket = connect(
      { hostname: proxy.hostname, port: Number(proxy.port) || 1080 },
      { secureTransport: "starttls", allowHalfOpen: true },
    ) as CloudflareSocket;
    await socket.opened;
    await establishSocksTunnel(socket, "api.moolre.com", 443, proxy.username, proxy.password);

    const secureSocket = socket.startTls({ expectedServerHostname: "api.moolre.com" });
    socket = secureSocket;
    await secureSocket.opened;

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

    const writer = secureSocket.writable.getWriter();
    await writer.write(new TextEncoder().encode(request));
    await writer.close();

    const reader = new SocketByteReader(secureSocket.readable);
    return await readHttpResponse(reader);
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
