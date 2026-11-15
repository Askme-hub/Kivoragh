import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Finds the account that owns a phone number (phone-only or email account with this phone). */
async function findUserByPhone(admin: any, phone: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("id")
    .eq("phone", phone).order("phone_verified_at", { ascending: false, nullsFirst: false }).limit(1);
  return data?.[0]?.id ?? null;
}

export const sendPhoneResetCode = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ phone: z.string().trim().min(7).max(20) }).parse(i))
  .handler(async ({ data }) => {
    const { normalizeGhanaPhone, sendSMS } = await import("./sms.server");
    const phone = normalizeGhanaPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Ghana phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await findUserByPhone(supabaseAdmin, phone);
    // Don't reveal whether the number has an account.
    if (!userId) return { ok: true };
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin.from("phone_verifications").select("created_at")
      .eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false });
    if ((recent?.length ?? 0) >= 3) throw new Error("Too many codes requested. Try again in 10 minutes.");
    if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000)
      throw new Error("Please wait a minute before requesting another code.");
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = String(arr[0] % 1_000_000).padStart(6, "0");
    const { error } = await supabaseAdmin.from("phone_verifications").insert({
      user_id: userId, phone: `reset:${phone}`,
      code_hash: await sha256(`reset:${phone}:${code}`),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw new Error("Could not create code");
    const r = await sendSMS(phone, `${code} is your Kivora password reset code. Valid 10 mins. Do not share.`);
    if (!r.ok) throw new Error("Could not send SMS. Try again shortly.");
    return { ok: true };
  });

export const resetPasswordWithPhone = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    phone: z.string().trim().min(7).max(20),
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
  }).parse(i))
  .handler(async ({ data }) => {
    const { normalizeGhanaPhone } = await import("./sms.server");
    const phone = normalizeGhanaPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Ghana phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("phone_verifications").select("*")
      .eq("phone", `reset:${phone}`).is("verified_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) throw new Error("Request a new code");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= 5) throw new Error("Too many attempts. Request a new code.");
    if ((await sha256(`reset:${phone}:${data.code}`)) !== row.code_hash) {
      await supabaseAdmin.from("phone_verifications").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Incorrect code");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password: data.password });
    if (error) throw new Error(error.message.includes("weak") || error.message.includes("pwned") ? "Choose a stronger password" : "Could not reset password");
    await supabaseAdmin.from("phone_verifications").update({ verified_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true };
  });
