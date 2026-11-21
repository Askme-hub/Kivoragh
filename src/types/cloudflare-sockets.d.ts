declare module "cloudflare:sockets" {
  export type Socket = {
    opened: Promise<unknown>;
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    startTls(options: { expectedServerHostname: string }): Socket;
    close(): Promise<void>;
  };
  export function connect(
    address: { hostname: string; port: number },
    options?: { secureTransport?: "off" | "on" | "starttls"; allowHalfOpen?: boolean },
  ): Socket;
}
