import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * A seller may request verification for their own already-approved shop.
 * The database trigger independently restricts the only permitted transition
 * to not_verified/rejected -> pending and writes the audit log.
 */
export const requestSellerVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) throw new Error("You can only request verification for your own shop.");

    const { data: shop, error: readError } = await context.supabase
      .from("seller_profiles")
      .select("status, verification_status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (readError) throw new Error("Could not load your shop verification status.");
    if (!shop) throw new Error("Seller shop not found.");
    if (shop.status !== "approved") throw new Error("Your shop must be approved before requesting verification.");
    if (!["not_verified", "rejected"].includes(shop.verification_status)) {
      throw new Error("Your shop already has a verification request or is verified.");
    }

    const { data: updated, error: updateError } = await context.supabase
      .from("seller_profiles")
      .update({ verification_status: "pending" })
      .eq("user_id", context.userId)
      .eq("status", "approved")
      .in("verification_status", ["not_verified", "rejected"])
      .select("user_id")
      .maybeSingle();

    if (updateError) throw new Error("Could not submit your verification request: " + updateError.message);
    if (!updated) throw new Error("Your shop verification status changed. Refresh and try again.");

    return { ok: true };
  });
