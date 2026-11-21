// Server-only Moolre payout transport.
// The actual HTTP request runs in a Supabase Edge Function, where Deno's
// native HTTP client can use Fixie's authenticated HTTP proxy correctly.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type MoolreReply = {
  status?: number | string;
  code?: string;
  message?: string | string[] | null;
  data?: any;
  error?: { message?: string };
};

export async function moolrePayoutRequest(
  path: "/open/transact/validate" | "/open/transact/transfer" | "/open/transact/status" | "/open/account/status",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MoolreReply> {
  const { data, error } = await supabaseAdmin.functions.invoke("moolre-payout", {
    body: { path, body, idempotencyKey },
  });

  if (error) {
    throw new Error("Could not reach the secure Moolre payout service: " + error.message);
  }
  if (!data || typeof data !== "object") {
    throw new Error("The secure Moolre payout service returned an empty response.");
  }
  if (typeof data.error === "string") {
    throw new Error(data.error);
  }
  if (!data.result || typeof data.result !== "object") {
    throw new Error("The secure Moolre payout service did not return a Moolre result.");
  }

  return data.result as MoolreReply;
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
