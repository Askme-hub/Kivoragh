import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Phone accounts get a private internal address; no SMS or email is sent. */
const phoneEmail = (p: string) => `p${p}@phone.kivora.shop`;

async function tokensFor(email: string, password: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export const phoneLogin = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ phone: z.string().trim().min(7).max(20), password: z.string().min(1).max(72) }).parse(i))
  .handler(async ({ data }) => {
    const { normalizeGhanaPhone } = await import("./sms.server");
    const phone = normalizeGhanaPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Ghana phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const candidates = [phoneEmail(phone)];
    const { data: rows } = await supabaseAdmin.from("profiles").select("email")
      .eq("phone", phone).order("phone_verified_at", { ascending: false, nullsFirst: false }).limit(3);
    for (const r of rows ?? []) if (r.email && !candidates.includes(r.email)) candidates.push(r.email);
    for (const email of candidates) {
      const t = await tokensFor(email, data.password);
      if (t) return t;
    }
    throw new Error("Wrong phone number or password");
  });

export const phoneSignup = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(20),
    password: z.string().min(8).max(72),
  }).parse(i))
  .handler(async ({ data }) => {
    const { normalizeGhanaPhone } = await import("./sms.server");
    const phone = normalizeGhanaPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Ghana phone number");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin.from("profiles").select("id").eq("phone", phone).limit(1);
    if (taken?.length) throw new Error("This phone number already has an account. Please log in.");
    const email = phoneEmail(phone);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { display_name: data.name, phone, terms_accepted_at: new Date().toISOString() },
    });
    if (error || !created.user) throw new Error(error?.message?.includes("registered") ? "This phone number already has an account." : "Could not create account");
    await supabaseAdmin.from("profiles").update({ phone, email: null, terms_accepted_at: new Date().toISOString() }).eq("id", created.user.id);
    const t = await tokensFor(email, data.password);
    if (!t) throw new Error("Account created. Please log in.");
    return t;
  });
