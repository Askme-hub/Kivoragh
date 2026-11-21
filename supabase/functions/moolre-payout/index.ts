// Supabase Edge Function: secure Moolre API transport through Fixie HTTP proxy.
// This function is protected by Supabase JWT verification. The Kivora server invokes
// it with its service-role client; never call it directly from browser code.

const ALLOWED_PATHS = new Set([
  "/open/transact/validate",
  "/open/transact/transfer",
  "/open/transact/status",
  "/open/account/status",
]);

type RequestBody = {
  path?: string;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  let input: RequestBody;
  try {
    input = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const path = input.path;
  if (!path || !ALLOWED_PATHS.has(path)) {
    return Response.json({ error: "Unsupported Moolre endpoint." }, { status: 400 });
  }
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return Response.json({ error: "A valid Moolre request body is required." }, { status: 400 });
  }

  const fixieValue = Deno.env.get("FIXIE_URL");
  const apiUser = Deno.env.get("MOOLRE_API_USER");
  const apiKey = Deno.env.get("MOOLRE_API_KEY");
  const accountNumber = Deno.env.get("MOOLRE_ACCOUNT_NUMBER");

  if (!fixieValue || !apiUser || !apiKey || !accountNumber) {
    return Response.json({
      error: "Moolre payout transport is missing one or more Supabase Edge Function secrets.",
      requiredSecrets: ["FIXIE_URL", "MOOLRE_API_USER", "MOOLRE_API_KEY", "MOOLRE_ACCOUNT_NUMBER"],
    }, { status: 500 });
  }

  let proxyUrl: URL;
  try {
    proxyUrl = new URL(fixieValue);
    if (proxyUrl.protocol !== "http:" || !proxyUrl.hostname || !proxyUrl.username || !proxyUrl.password) {
      throw new Error("Invalid Fixie HTTP proxy URL.");
    }
  } catch {
    return Response.json({ error: "FIXIE_URL is not a valid authenticated HTTP proxy URL." }, { status: 500 });
  }

  // Deno's native HTTP client supports authenticated HTTP CONNECT proxying.
  // This is the documented Fixie + Supabase Edge Functions integration.
  const client = Deno.createHttpClient({
    proxy: { url: proxyUrl.toString() },
  });

  try {
    const headers = new Headers({
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-API-USER": apiUser,
      "X-API-KEY": apiKey,
      "X-Request-Id": "kivora-" + crypto.randomUUID(),
    });
    if (input.idempotencyKey) {
      headers.set("Idempotency-Key", input.idempotencyKey);
    }

    const response = await fetch("https://api.moolre.com" + path, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...input.body, accountnumber: accountNumber }),
      client,
      signal: AbortSignal.timeout(25_000),
    });

    const responseText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return Response.json({
        error: "Moolre or the proxy returned a non-JSON response.",
        upstreamHttpStatus: response.status,
        responsePreview: responseText.slice(0, 300),
      }, { status: 502 });
    }

    return Response.json({
      upstreamHttpStatus: response.status,
      result: parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy or Moolre request error.";
    return Response.json({ error: "Moolre request through Fixie failed: " + message }, { status: 502 });
  } finally {
    client.close();
  }
});
