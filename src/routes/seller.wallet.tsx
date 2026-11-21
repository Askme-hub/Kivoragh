import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, Clock, TrendingUp, Plus, Trash2, Check, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatGHC } from "@/lib/store";
import { requestWithdrawal } from "@/lib/wallet.functions";
import {
  usePayoutAccounts,
  useSavePayoutAccount,
  useDeletePayoutAccount,
} from "@/lib/payout-accounts";

export const Route = createFileRoute("/seller/wallet")({
  component: SellerWallet,
  head: () => ({ meta: [{ title: "Wallet — Kivora Seller" }] }),
});

const METHODS = ["Mobile Money", "Bank Transfer"];
const MOMO_NETWORKS = ["MTN Mobile Money", "Telecel Cash", "AT Money"];
/** Valid Ghana mobile number: 0XXXXXXXXX or 233XXXXXXXXX with a known network prefix. */
function validMomo(n: string) {
  const d = n.replace(/\D/g, "");
  const local = d.startsWith("233") ? "0" + d.slice(3) : d;
  return /^0(?:20|23|24|25|26|27|28|29|50|53|54|55|56|57|59)\d{7}$/.test(local);
}

function SellerWallet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const submit = useServerFn(requestWithdrawal);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Add-account form
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState(METHODS[0]);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);

  const { data: accounts = [] } = usePayoutAccounts();
  const saveAccount = useSavePayoutAccount();
  const deleteAccount = useDeletePayoutAccount();

  const { data: wallet } = useQuery({
    queryKey: ["seller-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Move any sales whose 48h escrow has passed into the available balance
      await supabase.rpc("release_seller_escrow", { _seller_id: user!.id });
      const { data } = await supabase
        .from("seller_wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: txns } = useQuery({
    queryKey: ["seller-txns", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["seller-withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Default selected account
  useEffect(() => {
    if (selectedAccount || accounts.length === 0) {
      if (accounts.length === 0) setShowForm(true);
      return;
    }
    const def = accounts.find((a) => a.is_default) ?? accounts[0];
    setSelectedAccount(def.id);
  }, [accounts, selectedAccount]);

  if (!user) return <div className="p-6 text-sm">Please log in.</div>;

  const balance = Number(wallet?.balance ?? 0);

  const addAccount = async () => {
    if (accountName.trim().length < 2) return toast.error("Enter the account holder name");
    if (accountName.trim().split(/\s+/).length < 2) return toast.error("Enter the full registered name (first and last)");
    if (method === "Mobile Money") {
      if (!MOMO_NETWORKS.includes(provider)) return toast.error("Choose the MoMo network");
      if (!validMomo(accountNumber)) return toast.error("Enter a valid Ghana mobile number e.g. 024XXXXXXX");
    } else if (accountNumber.trim().length < 6) return toast.error("Enter a valid bank account number");
    if (method === "Bank Transfer" && provider.trim().length < 2) return toast.error("Enter the bank name");
    try {
      const saved = await saveAccount.mutateAsync({
        method,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        provider: provider.trim() || null,
        is_default: makeDefault || accounts.length === 0,
      });
      setSelectedAccount(saved.id);
      setAccountName("");
      setAccountNumber("");
      setProvider("");
      setShowForm(false);
      toast.success("Payout account saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save account");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > balance) return toast.error("Amount exceeds available balance");
    if (!selectedAccount) return toast.error("Select a saved payout account");
    setBusy(true);
    try {
      const result = await submit({ data: { amount: amt, payout_account_id: selectedAccount } });
      if (result.payoutStatus === "paid") toast.success("Moolre payout completed successfully");
      else if (result.payoutStatus === "failed") toast.error("Moolre could not complete the payout. The reserved funds have been returned.");
      else if (result.payoutStatus === "needs_review") toast.warning("Withdrawal reserved for admin review. No second payout will be sent.");
      else toast.success("Withdrawal submitted. Moolre is processing the payout.");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["seller-wallet", user.id] });
      qc.invalidateQueries({ queryKey: ["seller-withdrawals", user.id] });
      qc.invalidateQueries({ queryKey: ["seller-txns", user.id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-3 pb-10 pt-4 sm:px-5 md:pt-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Seller finances</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">My wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your earnings, payouts and money activity in one place.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-success" /> Secure seller wallet
        </div>
      </header>

      {balance < 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-bold text-destructive">Outstanding Pay on Delivery commission: {formatGHC(Math.abs(balance))}</p>
          <p className="mt-1 text-muted-foreground">For Pay on Delivery orders you collect the cash, so Kivora's commission is charged to your wallet. It will be cleared automatically from your next online sales. Withdrawals are paused until your balance is positive.</p>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary-foreground/10" />
        <div className="pointer-events-none absolute -bottom-24 right-28 h-44 w-44 rounded-full bg-primary-foreground/10" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary-foreground/80"><Wallet size={17} /> Available to withdraw</p>
            <p className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{formatGHC(balance)}</p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-primary-foreground/75">Only cleared funds are available for withdrawal. Recent sales may remain in escrow for 48 hours.</p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("wallet-withdraw")?.scrollIntoView({ behavior: "smooth", block: "center" })}
            disabled={balance <= 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 text-sm font-bold text-primary shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownToLine size={17} /> Withdraw funds
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="In escrow · 48h" value={formatGHC(Number((wallet as any)?.escrow ?? 0))} icon={Clock} color="text-info-ink" />
        <StatCard label="Withdrawal pending" value={formatGHC(Number(wallet?.pending ?? 0))} icon={Clock} color="text-warning-ink" />
        <StatCard label="Total earned" value={formatGHC(Number(wallet?.total_earned ?? 0))} icon={TrendingUp} color="text-primary" />
        <StatCard label="Total withdrawn" value={formatGHC(Number(wallet?.total_withdrawn ?? 0))} icon={ArrowDownToLine} color="text-muted-foreground" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CreditCard size={19} /></span>
              <div>
                <h2 className="text-sm font-bold">Payout accounts</h2>
                <p className="text-xs text-muted-foreground">Where Kivora sends your withdrawals</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold transition hover:bg-muted"
            >
              <Plus size={14} /> {showForm ? "Close" : "Add account"}
            </button>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2 p-4 sm:p-5">
              {accounts.map((a) => {
                const active = selectedAccount === a.id;
                return (
                  <div key={a.id} className={`rounded-xl border p-3 transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary/15" : "border-border hover:bg-muted/30"}`}>
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setSelectedAccount(a.id)} aria-label={`Select ${a.method} payout account`} className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-primary">
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </button>
                      <button type="button" onClick={() => setSelectedAccount(a.id)} className="min-w-0 flex-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{a.account_name}</span>
                          {a.is_default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Default</span>}
                          {active && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success-ink">Selected</span>}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{a.method}{a.provider ? ` · ${a.provider}` : ""} · {a.account_number}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Remove payout account"
                        onClick={() => {
                          if (confirm("Remove this payout account?")) {
                            deleteAccount.mutate(a.id, {
                              onSuccess: () => { if (selectedAccount === a.id) setSelectedAccount(null); },
                            });
                          }
                        }}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(showForm || accounts.length === 0) && (
            <div className="space-y-3 border-t border-border bg-muted/20 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-bold">{accounts.length ? "Add another account" : "Add your payout account"}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Use the exact name registered with your bank or MoMo provider.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                  Payout method
                  <select value={method} onChange={(e) => { setMethod(e.target.value); setProvider(""); }} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary">
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                  Account holder name
                  <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary" placeholder="Full registered name" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                  {method === "Mobile Money" ? "MoMo number" : "Bank account number"}
                  <input
                    type={method === "Mobile Money" ? "tel" : "text"}
                    inputMode={method === "Mobile Money" ? "tel" : "text"}
                    autoComplete={method === "Mobile Money" ? "tel-national" : "off"}
                    maxLength={method === "Mobile Money" ? 14 : 40}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9+ ]/g, ""))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary"
                    placeholder={method === "Mobile Money" ? "025XXXXXXX or +23325XXXXXXX" : "Account number"}
                  />
                  {method === "Mobile Money" && <p className="text-[11px] leading-relaxed text-muted-foreground">Enter your 10-digit Ghana number starting with 0, or use the +233 country code. Example: 025XXXXXXX.</p>}
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                  {method === "Mobile Money" ? "Mobile network" : "Bank name"}
                  {method === "Mobile Money" ? (
                    <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary">
                      <option value="">Select network</option>
                      {MOMO_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input value={provider} onChange={(e) => setProvider(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary" placeholder="e.g. GCB Bank" />
                  )}
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-primary" />
                Set as my default payout account
              </label>
              <button type="button" onClick={addAccount} disabled={saveAccount.isPending} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
                {saveAccount.isPending ? "Saving account…" : "Save payout account"}
              </button>
            </div>
          )}
        </section>

        <section id="wallet-withdraw" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success-ink"><ArrowDownToLine size={19} /></span>
            <div>
              <h2 className="text-sm font-bold">Request a withdrawal</h2>
              <p className="text-xs text-muted-foreground">Send cleared earnings to your account</p>
            </div>
          </div>
          {accounts.length === 0 ? (
            <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">Add a payout account first to request a withdrawal.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Available balance</p>
                <p className="mt-1 text-xl font-extrabold">{formatGHC(balance)}</p>
              </div>
              <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
                Withdrawal amount (GHS)
                <input type="number" min="1" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-3 text-lg font-bold text-foreground outline-none focus:border-primary" placeholder="0.00" />
              </label>
              <p className="text-xs leading-relaxed text-muted-foreground">Your request is sent to Moolre after the registered account name is verified. You can track its status below.</p>
              <button type="submit" disabled={busy || balance <= 0 || !selectedAccount} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Submitting request…" : "Request withdrawal"}
              </button>
            </form>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-sm font-bold">Withdrawal requests</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Follow the progress of your payout requests.</p>
        </div>
        {requests?.length ? (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="font-bold">{formatGHC(Number(r.amount))}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.method} · {new Date(r.created_at).toLocaleDateString()}</p>
                  {r.payout_provider === "moolre" && r.payout_status && r.payout_status !== "not_started" && (
                    <p className="mt-1 text-xs font-semibold text-primary">
                      Moolre payout: {String(r.payout_status).replaceAll("_", " ")}
                    </p>
                  )}
                  {r.payout_last_error && <p className="mt-1 text-xs text-destructive">{r.payout_last_error}</p>}
                  {r.admin_note && <p className="mt-1 text-xs text-muted-foreground">Note: {r.admin_note}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        ) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No withdrawal requests yet.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-sm font-bold">Transaction history</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Your latest wallet activity, newest first.</p>
        </div>
        {txns?.length ? (
          <div className="divide-y divide-border">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${Number(t.amount) >= 0 ? "bg-success/10 text-success-ink" : "bg-muted text-muted-foreground"}`}>
                  {Number(t.amount) >= 0 ? <TrendingUp size={16} /> : <ArrowDownToLine size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.description ?? t.type}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`shrink-0 text-sm font-extrabold tabular-nums ${Number(t.amount) >= 0 ? "text-success-ink" : "text-foreground"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}{formatGHC(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No transactions yet. Earnings appear when orders are delivered.</p>}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <Icon size={18} className={color} />
      <p className="text-lg font-bold mt-1 truncate">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning-soft text-warning-ink",
    approved: "bg-info-soft text-info-ink",
    paid: "bg-success-soft text-success-ink",
    rejected: "bg-danger-soft text-danger-ink",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}
