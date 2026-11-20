import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Gift, Share2, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/referrals")({
  component: ReferralsPage,
  head: () => ({ meta: [{ title: "My Referrals — Kivora Ghana" }] }),
});

type ReferralEvent = {
  id: string;
  referred_user_type: "customer" | "seller";
  event_type: string;
  status: string;
  qualification_amount: number | null;
  created_at: string;
  qualified_at: string | null;
};

function ReferralsPage() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [userType, setUserType] = useState<"customer" | "seller">("customer");
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: codeRows, error: codeError }, { data: settings }, { data: rows, error: eventError }] = await Promise.all([
        (supabase as any).rpc("get_or_create_my_referral_code"),
        (supabase as any).rpc("referral_program_is_enabled"),
        (supabase as any).from("referral_events").select("id,referred_user_type,event_type,status,qualification_amount,created_at,qualified_at").eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (codeError) toast.error("Could not load your referral code");
      else {
        const row = Array.isArray(codeRows) ? codeRows[0] : codeRows;
        setCode(row?.code ?? "");
        setUserType(row?.user_type ?? "customer");
      }
      if (eventError) toast.error("Could not load referral activity");
      else setEvents((rows ?? []) as ReferralEvent[]);
      setEnabled(Boolean(settings));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  const referralLink = useMemo(() => {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/login?ref=${encodeURIComponent(code)}`;
  }, [code]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Please select and copy it manually.");
    }
  };

  const qualified = events.filter((e) => e.status === "qualified").length;
  const pending = events.filter((e) => e.status === "pending").length;

  if (!user) return <div className="p-6">Please <Link to="/login" className="text-primary underline">log in</Link> to view referrals.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <Link to="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} /> Back to account</Link>
      <div className="mt-5 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Gift size={24} /></div>
        <div><h1 className="text-2xl font-bold">Invite & Earn</h1><p className="text-sm text-muted-foreground">Share Kivora and earn Store Credit when referrals qualify.</p></div>
      </div>

      {!enabled && <div className="mt-5 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">The referral programme is not active yet. Your code will be ready, and rewards will begin when Kivora activates the programme.</div>}

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your {userType} referral code</p>
        {loading ? <div className="mt-3 h-8 animate-pulse rounded bg-muted" /> : (
          <>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-2xl font-extrabold tracking-[0.18em]">{code || "—"}</span>
              <button onClick={() => copy(code, "Referral code")} disabled={!code} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"><Copy size={15} /> Copy</button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => copy(referralLink, "Referral link")} disabled={!referralLink} className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><Share2 size={16} className="mr-2 inline" />Copy invite link</button>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Your friend must enter your code when creating their Kivora account. Signing up alone does not earn a reward.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users size={16} /> Qualified</div><p className="mt-1 text-2xl font-bold">{qualified}</p></div>
        <div className="rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Gift size={16} /> In progress</div><p className="mt-1 text-2xl font-bold">{pending}</p></div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-bold">Referral activity</h2>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading activity…</p> : events.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No referrals yet. Share your code to invite your first friend.</p> : (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 p-4">
                <div><p className="font-semibold capitalize">{event.referred_user_type} referral</p><p className="mt-1 text-xs text-muted-foreground">{event.event_type === "registration" ? "Waiting for qualifying activity" : event.event_type.replaceAll("_", " ")}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === "qualified" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{event.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
