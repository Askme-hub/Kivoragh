// Server-only Moolre disbursement client for Cloudflare Workers.
// Uses Fixie's HTTP CONNECT tunnel so Moolre sees a whitelisted static egress IP.
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
    throw new Error("Moolre seller payouts are not fully configured.");
  }
  const proxy = new URL(proxyValue);
  if (!["http:", "https:"].includes(proxy.protocol) || !proxy.hostname || !proxy.username || !proxy.password) {
    throw new Error("The Fixie proxy configuration is invalid.");
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

async function readUntilHeaderEnd(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 16_384) {
    const { value, done } = await reader.read();
    if (done || !value) throw new Error("Fixie closed the connection before completing the proxy handshake.");
    chunks.push(value);
    total += value.length;
    const joined = joinBytes(chunks);
    const text = new TextDecoder().decode(joined);
    const marker = text.indexOf("\r\n\r\n");
    if (marker >= 0) return text.slice(0, marker);
  }
  throw new Error("Fixie returned an invalid proxy handshake.");
}

async function readHttpResponse(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 262_144) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.length;
  }
  if (total >= 262_144) throw new Error("Moolre response exceeded the allowed size.");
  const raw = new TextDecoder().decode(joinBytes(chunks));
  const splitAt = raw.indexOf("\r\n\r\n");
  if (splitAt < 0) throw new Error("Moolre returned an incomplete HTTP response.");
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

/**
 * HTTPS request through Fixie's authenticated HTTP CONNECT proxy.
 * Cloudflare Workers fetch does not consume Node's agent option, so this uses
 * the Workers TCP socket API and explicitly establishes the CONNECT tunnel.
 */
export async function moolrePayoutRequest(
  path: "/open/transact/validate" | "/open/transact/transfer" | "/open/transact/status",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MoolreReply> {
  const { proxy, user, key, account } = payoutConfig();
  if (proxy.protocol !== "http:") {
    throw new Error("Use the Fixie HTTP proxy URL (http://…:80) for this Cloudflare Worker connection.");
  }

  const { connect } = await import("cloudflare:sockets");
  let socket: CloudflareSocket | undefined;
  try {
    socket = connect(
      { hostname: proxy.hostname, port: Number(proxy.port) || 80 },
      { secureTransport: "starttls" },
    ) as CloudflareSocket;
    await socket.opened;

    const proxyAuth = btoa(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`);
    const proxyWriter = socket.writable.getWriter();
    await proxyWriter.write(new TextEncoder().encode(
      `CONNECT api.moolre.com:443 HTTP/1.1\r\nHost: api.moolre.com:443\r\nProxy-Authorization: Basic ${proxyAuth}\r\nProxy-Connection: keep-alive\r\n\r\n`,
    ));
    await proxyWriter.releaseLock();

    const proxyReader = socket.readable.getReader();
    const proxyHeader = await readUntilHeaderEnd(proxyReader);
    await proxyReader.cancel().catch(() => undefined);
    const proxyStatus = Number(proxyHeader.split("\r\n", 1)[0]?.split(" ")[1]);
    if (proxyStatus !== 200) throw new Error(`Fixie could not open the secure Moolre tunnel (HTTP ${proxyStatus || "unknown"}).`);

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

    const reader = secureSocket.readable.getReader();
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
