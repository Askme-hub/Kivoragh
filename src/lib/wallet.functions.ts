import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { moolrePayoutRequest, moolreChannelForProvider, normalizeMoolreName } from "@/lib/moolre-payout.server";
import { toLocalPhone } from "@/lib/moolre.server";

const withdrawalSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  payout_account_id: z.string().uuid(),
});

// Seller requests a withdrawal — moves funds from balance to pending.
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: isSeller } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "seller")
      .maybeSingle();
    if (!isSeller) throw new Error("Only sellers can request withdrawals.");

    const { data: account } = await supabaseAdmin
      .from("payout_accounts")
      .select("*")
      .eq("id", data.payout_account_id)
      .eq("seller_id", userId)
      .maybeSingle();
    if (!account) throw new Error("Select a valid saved payout account.");

    if (account.method !== "Mobile Money") {
      throw new Error("Bank payouts will be enabled in a later phase. Please select an MTN, Telecel or AT Money account.");
    }
    const channel = moolreChannelForProvider(account.provider);
    if (!channel) throw new Error("This mobile money network is not supported for automatic payouts.");
    if (!process.env.FIXIE_SOCKS_URL || !process.env.MOOLRE_API_KEY || !process.env.MOOLRE_API_USER || !process.env.MOOLRE_ACCOUNT_NUMBER) {
      throw new Error("Automatic payouts are not ready yet. Please contact Kivora support; your wallet balance has not been reserved.");
    }
    const receiver = toLocalPhone(String(account.account_number));
    if (!/^0\\d{9}$/.test(receiver)) throw new Error("The saved mobile money number is invalid. Update your payout account first.");

    const { error: escrowErr } = await supabaseAdmin.rpc("release_seller_escrow", { _seller_id: userId });
    if (escrowErr) throw new Error(escrowErr.message);

    // The database function locks the seller wallet and creates the request,
    // reserves the funds, and records the ledger entry in one transaction.
    const { data: requestId, error: withdrawalErr } = await supabaseAdmin.rpc(
      "create_seller_withdrawal",
      {
        _seller_id: userId,
        _amount: data.amount,
        _payout_account_id: data.payout_account_id,
      },
    );

    if (withdrawalErr) throw new Error(withdrawalErr.message);
    if (!requestId || typeof requestId !== "string") {
      throw new Error("The withdrawal request could not be created. Please try again.");
    }

    // Create a durable payout attempt before contacting Moolre. The unique external
    // reference is reused for status checks and is never regenerated after uncertainty.
    const externalref = `KIV-${requestId.replace(/-/g, "").slice(0, 24)}`;
    const { error: attemptErr } = await (supabaseAdmin as any)
      .from("moolre_payout_attempts")
      .insert({
        withdrawal_id: requestId,
        seller_id: userId,
        externalref,
        channel,
        receiver,
        expected_name: String(account.account_name).trim(),
        amount: Number(data.amount).toFixed(2),
        status: "queued",
      });

    if (attemptErr) {
      await supabaseAdmin.from("withdrawal_requests").update({
        payout_status: "needs_review",
        payout_provider: "moolre",
        payout_last_error: "Payout attempt could not be recorded. No transfer was sent.",
        payout_updated_at: new Date().toISOString(),
      }).eq("id", requestId);
      return { id: requestId, payoutStatus: "needs_review" as const };
    }

    const markReview = async (message: string, code?: string) => {
      await (supabaseAdmin as any).from("moolre_payout_attempts").update({
        status: "needs_review",
        moolre_code: code ?? null,
        moolre_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("externalref", externalref);
      await supabaseAdmin.from("withdrawal_requests").update({
        payout_status: "needs_review",
        payout_provider: "moolre",
        payout_last_error: message.slice(0, 500),
        payout_updated_at: new Date().toISOString(),
      }).eq("id", requestId);
      return { id: requestId, payoutStatus: "needs_review" as const };
    };

    await supabaseAdmin.from("withdrawal_requests").update({
      payout_status: "validating",
      payout_provider: "moolre",
      payout_updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    let validation: any;
    try {
      validation = await moolrePayoutRequest("/open/transact/validate", {
        type: 1, receiver, channel, currency: "GHS",
      });
    } catch (error) {
      return await markReview(error instanceof Error ? error.message : "Moolre name validation could not be completed. No transfer was sent.");
    }

    const validatedName = typeof validation.data === "string" ? validation.data.trim() : "";
    if (Number(validation.status) !== 1 || !validatedName) {
      return await markReview(
        typeof validation.message === "string" ? validation.message : "Moolre could not validate this mobile money account.",
        validation.code,
      );
    }
    if (normalizeMoolreName(validatedName) !== normalizeMoolreName(String(account.account_name))) {
      await (supabaseAdmin as any).from("moolre_payout_attempts").update({
        status: "needs_review",
        validated_name: validatedName,
        moolre_code: validation.code ?? null,
        moolre_message: "Registered recipient name does not match the seller's saved payout name.",
        updated_at: new Date().toISOString(),
      }).eq("externalref", externalref);
      await supabaseAdmin.from("withdrawal_requests").update({
        payout_status: "needs_review",
        payout_provider: "moolre",
        payout_last_error: `Name mismatch. Moolre returned: ${validatedName}`,
        payout_updated_at: new Date().toISOString(),
      }).eq("id", requestId);
      return { id: requestId, payoutStatus: "needs_review" as const };
    }

    await (supabaseAdmin as any).from("moolre_payout_attempts").update({
      status: "processing",
      validated_name: validatedName,
      moolre_code: validation.code ?? null,
      updated_at: new Date().toISOString(),
    }).eq("externalref", externalref);
    await supabaseAdmin.from("withdrawal_requests").update({
      payout_status: "processing",
      payout_provider: "moolre",
      payout_last_error: null,
      payout_updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    let transfer: any;
    try {
      transfer = await moolrePayoutRequest("/open/transact/transfer", {
        type: 1,
        channel,
        currency: "GHS",
        amount: Number(data.amount).toFixed(2),
        receiver,
        externalref,
        reference: `Kivora seller withdrawal`,
        sendername: "Kivora",
      }, externalref);
    } catch {
      // A timeout is ambiguous. Query this same reference; never send a second transfer.
      try {
        transfer = await moolrePayoutRequest("/open/transact/status", {
          type: 1, idtype: 1, id: externalref,
        });
      } catch {
        await (supabaseAdmin as any).from("moolre_payout_attempts").update({
          status: "processing",
          moolre_message: "Transfer response was uncertain; awaiting status confirmation.",
          updated_at: new Date().toISOString(),
        }).eq("externalref", externalref);
        return { id: requestId, payoutStatus: "processing" as const };
      }
    }

    const txstatus = Number(transfer?.data?.txstatus);
    const transactionId = transfer?.data?.transactionid ? String(transfer.data.transactionid) : null;
    const code = transfer?.code ? String(transfer.code) : null;
    const message = Array.isArray(transfer?.message)
      ? transfer.message.join(" ")
      : String(transfer?.message ?? transfer?.data?.reason ?? "");

    if (txstatus === 1 || txstatus === 2) {
      const outcome = txstatus === 1 ? "paid" : "failed";
      // Persist the final Moolre evidence before touching the wallet ledger.
      // If the database finalization fails, an admin can reconcile but cannot refund blindly.
      await (supabaseAdmin as any).from("moolre_payout_attempts").update({
        status: outcome,
        moolre_transaction_id: transactionId,
        moolre_code: code,
        moolre_message: message.slice(0, 500),
        txstatus,
        updated_at: new Date().toISOString(),
      }).eq("externalref", externalref);
      const { error: finalErr } = await (supabaseAdmin as any).rpc("finalize_moolre_seller_withdrawal", {
        _withdrawal_id: requestId,
        _outcome: outcome,
        _moolre_transaction_id: transactionId,
        _moolre_code: code,
        _moolre_message: message,
        _txstatus: txstatus,
      });
      if (finalErr) {
        await markReview("Moolre returned a final status but the wallet ledger could not be updated. Admin reconciliation is required.", code ?? undefined);
        throw new Error("Moolre returned a result that needs admin reconciliation. Do not request another withdrawal.");
      }
      return { id: requestId, payoutStatus: outcome as "paid" | "failed" };
    }

    await (supabaseAdmin as any).from("moolre_payout_attempts").update({
      status: "processing",
      moolre_transaction_id: transactionId,
      moolre_code: code,
      moolre_message: message.slice(0, 500),
      txstatus: [0, 3].includes(txstatus) ? txstatus : null,
      updated_at: new Date().toISOString(),
    }).eq("externalref", externalref);
    await supabaseAdmin.from("withdrawal_requests").update({
      payout_status: "processing",
      payout_provider: "moolre",
      payout_last_error: null,
      payout_updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    return { id: requestId, payoutStatus: "processing" as const };
  });


const payoutAdminSchema = z.object({ id: z.string().uuid() });

async function assertWithdrawalAdmin(userId: string) {
  const { data: isAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!isAdmin) throw new Error("Only admins can manage withdrawals.");
}

// Reconcile an uncertain Moolre payout using its original external reference.
export const refreshMoolreWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payoutAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertWithdrawalAdmin(context.userId);
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id, payout_status")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error("Withdrawal request not found.");
    if (req.payout_status === "paid" || req.payout_status === "failed") {
      return { payoutStatus: req.payout_status };
    }

    const { data: attempt } = await (supabaseAdmin as any)
      .from("moolre_payout_attempts")
      .select("*")
      .eq("withdrawal_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!attempt) throw new Error("No Moolre attempt exists for this withdrawal.");

    const result = await moolrePayoutRequest("/open/transact/status", {
      type: 1, idtype: 1, id: attempt.externalref,
    });
    const txstatus = Number(result?.data?.txstatus);
    const transactionId = result?.data?.transactionid ? String(result.data.transactionid) : attempt.moolre_transaction_id;
    const code = result?.code ? String(result.code) : attempt.moolre_code;
    const message = Array.isArray(result?.message)
      ? result.message.join(" ")
      : String(result?.message ?? result?.data?.reason ?? "");

    if (txstatus === 1 || txstatus === 2) {
      const outcome = txstatus === 1 ? "paid" : "failed";
      await (supabaseAdmin as any).from("moolre_payout_attempts").update({
        status: outcome, txstatus, moolre_transaction_id: transactionId,
        moolre_code: code, moolre_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", attempt.id);
      const { error } = await (supabaseAdmin as any).rpc("finalize_moolre_seller_withdrawal", {
        _withdrawal_id: data.id,
        _outcome: outcome,
        _moolre_transaction_id: transactionId,
        _moolre_code: code,
        _moolre_message: message,
        _txstatus: txstatus,
      });
      if (error) throw new Error("Moolre status was found, but the wallet ledger needs admin attention: " + error.message);
      return { payoutStatus: outcome };
    }

    // SS07 / an unrecognized status means Moolre has no confirmed transfer record.
    // Keep a validation-only review request cancellable; never invent a pending transfer.
    if (req.payout_status === "needs_review" && ![0, 1, 2, 3].includes(txstatus)) {
      return { payoutStatus: "needs_review" };
    }

    await (supabaseAdmin as any).from("moolre_payout_attempts").update({
      status: "processing",
      txstatus: [0, 3].includes(txstatus) ? txstatus : attempt.txstatus,
      moolre_code: code,
      moolre_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", attempt.id);
    if (req.payout_status !== "needs_review") {
      await supabaseAdmin.from("withdrawal_requests").update({
        payout_status: "processing",
        payout_last_error: null,
        payout_updated_at: new Date().toISOString(),
      }).eq("id", data.id);
    }
    return { payoutStatus: req.payout_status === "needs_review" ? "needs_review" : "processing" };
  });

// Refund only a request that is proven not to have been submitted to Moolre.
export const cancelUnsubmittedMoolreWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payoutAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertWithdrawalAdmin(context.userId);
    const { error } = await (supabaseAdmin as any).rpc("cancel_unsubmitted_moolre_withdrawal", {
      _withdrawal_id: data.id,
      _admin_note: "Cancelled by admin before transfer submission",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const decisionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "paid"]),
  admin_note: z.string().max(500).optional(),
});

// Admin updates a withdrawal status and reconciles the seller wallet.
export const decideWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Error("Only admins can manage withdrawals.");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error("Withdrawal request not found.");
    if (req.status === "paid" || req.status === "rejected") {
      throw new Error("This request has already been finalized.");
    }
    // New Moolre-queued requests must only be finalized by verified Moolre status.
    // This prevents an admin action from refunding or marking funds paid while a transfer is in flight.
    if (req.payout_status && req.payout_status !== "not_started") {
      throw new Error("This withdrawal is in the Moolre payout queue and cannot be changed manually.");
    }

    const { data: wallet } = await supabaseAdmin
      .from("seller_wallets")
      .select("balance, pending, total_withdrawn")
      .eq("user_id", req.seller_id)
      .maybeSingle();

    const amount = Number(req.amount);
    const pending = Number(wallet?.pending ?? 0);

    if (data.status === "rejected") {
      // refund pending back to balance
      await supabaseAdmin
        .from("seller_wallets")
        .update({
          pending: Math.max(0, pending - amount),
          balance: Number(wallet?.balance ?? 0) + amount,
        })
        .eq("user_id", req.seller_id);
      await supabaseAdmin.from("transactions").insert({
        seller_id: req.seller_id,
        type: "withdrawal_refund",
        amount,
        description: "Withdrawal rejected — funds returned",
      });
    } else if (data.status === "paid") {
      // remove from pending, add to total_withdrawn
      await supabaseAdmin
        .from("seller_wallets")
        .update({
          pending: Math.max(0, pending - amount),
          total_withdrawn: Number(wallet?.total_withdrawn ?? 0) + amount,
        })
        .eq("user_id", req.seller_id);
      await supabaseAdmin.from("transactions").insert({
        seller_id: req.seller_id,
        type: "withdrawal",
        amount: -amount,
        status: "completed",
        description: "Withdrawal paid out",
      });
    }

    const { error: updErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: data.status, admin_note: data.admin_note ?? null })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

// Admin fetches all withdrawal requests with seller shop info.
export const getAllWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Error("Forbidden");

    const { data: requests } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    const ids = [...new Set((requests ?? []).map((r) => r.seller_id))];
    const { data: shops } = await supabaseAdmin
      .from("seller_profiles")
      .select("user_id, shop_name, phone")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const shopMap = new Map((shops ?? []).map((s) => [s.user_id, s]));

    return (requests ?? []).map((r) => ({
      ...r,
      shop_name: shopMap.get(r.seller_id)?.shop_name ?? "Unknown shop",
      shop_phone: shopMap.get(r.seller_id)?.phone ?? null,
    }));
  });
