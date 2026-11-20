import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/referrals")({
  component: AdminReferrals,
  head: () => ({ meta: [{ title: "Referral Programme — Kivora Admin" }] }),
});

function AdminReferrals() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [minimum, setMinimum] = useState("100");
  const [customerReward, setCustomerReward] = useState("0");
  const [sellerReward, setSellerReward] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("referral_settings").select("*").eq("id", true).maybeSingle();
      if (!active) return;
      if (error) toast.error("Could not load referral settings");
      if (data) {
        setEnabled(Boolean(data.enabled));
        setMinimum(String(data.customer_min_order_amount ?? 100));
        setCustomerReward(String(data.customer_referrer_reward ?? 0));
        setSellerReward(String(data.seller_referrer_reward ?? 0));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const save = async () => {
    const min = Number(minimum);
    const customer = Number(customerReward);
    const seller = Number(sellerReward);
    if (!Number.isFinite(min) || min < 100 || !Number.isFinite(customer) || customer < 0 || !Number.isFinite(seller) || seller < 0) {
      toast.error("Minimum order must be at least GH₵100 and rewards cannot be negative.");
      return;
    }
    if (enabled && customer <= 0 && seller <= 0) {
      toast.error("Set at least one reward amount before activating referrals.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("referral_settings").update({
      enabled, customer_min_order_amount: min, customer_referrer_reward: customer,
      seller_referrer_reward: seller, updated_by: user?.id ?? null, updated_at: new Date().toISOString(),
    }).eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Referral settings saved");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading referral settings…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Gift size={24} /></div><div><p className="text-xs font-bold text-primary">MARKETING CONTROL</p><h1 className="text-2xl font-bold">Referral programme</h1><p className="text-sm text-muted-foreground">Set reward values and control when referrals are active.</p></div></div>
      <section className="rounded-2xl border border-border bg-card p-5">
        <label className="flex items-center justify-between gap-4"><span><span className="block font-semibold">Enable referrals</span><span className="text-xs text-muted-foreground">When disabled, new referral codes cannot be claimed and no rewards are issued.</span></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-primary" /></label>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold">Customer referrals</h2>
        <div><label className="mb-1 block text-sm font-medium">Minimum first completed order (GHS)</label><input type="number" min="100" step="0.01" value={minimum} onChange={(e) => setMinimum(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /><p className="mt-1 text-xs text-muted-foreground">The first completed paid order must be at least GH₵100 to qualify.</p></div>
        <div><label className="mb-1 block text-sm font-medium">Reward to customer referrer (GHS)</label><input type="number" min="0" step="0.01" value={customerReward} onChange={(e) => setCustomerReward(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /></div>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold">Seller referrals</h2>
        <div><label className="mb-1 block text-sm font-medium">Reward to seller referrer (GHS)</label><input type="number" min="0" step="0.01" value={sellerReward} onChange={(e) => setSellerReward(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5" /><p className="mt-1 text-xs text-muted-foreground">Awarded after the referred seller completes their first successful delivered sale.</p></div>
      </section>
      <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Rewards are credited to Kivora Store Credit, not seller earnings. Customers cannot withdraw or transfer referral rewards. Registration and clicks alone never qualify.</div>
      <Button onClick={save} disabled={saving} className="w-full sm:w-auto"><Save size={16} className="mr-2" />{saving ? "Saving…" : "Save referral settings"}</Button>
    </div>
  );
}
