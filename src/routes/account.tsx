import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  MessageCircle, MessageSquare, Info, Package, Mail, Star,
  Ticket, Heart, Store, History, Search as SearchIcon, ChevronRight, Wallet, Shield, Settings, Gift,
} from "lucide-react";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile";
import { useIsSeller } from "@/hooks/use-seller";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  component: Account,
  head: () => ({ meta: [{ title: "My Account – Kivora Ghana" }, { name: "description", content: "Manage your Kivora profile, store credit, referrals, orders and account settings." }, { property: "og:title", content: "My Account – Kivora Ghana" }, { property: "og:description", content: "Your Kivora profile, orders, store credit and referrals in one place." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});


function Account() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: isAdmin } = useIsAdmin(user);
  const { data: isSeller } = useIsSeller(user);
  const { data: profile } = useProfile(user?.id);
  const [storeCredit, setStoreCredit] = useState(0);
  useEffect(() => {
    if (!user?.id) { setStoreCredit(0); return; }
    let active = true;
    (supabase as any).from("marketing_wallets").select("promotional_balance").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }: any) => { if (active && !error) setStoreCredit(Number(data?.promotional_balance ?? 0)); });
    return () => { active = false; };
  }, [user?.id]);
  const avatarUrl =
    profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null;



  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/login" });
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!user) {
    return (
      <div>
        <div className="mx-auto max-w-lg px-6 py-14 text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary"><Wallet size={28} /></div>
          <h1 className="font-display text-3xl font-bold">Your Kivora account</h1>
          <p className="text-muted-foreground text-sm mt-2">Sign in to view your account, orders and inbox.</p>
          <Button asChild className="mt-6 rounded-full px-6"><Link to="/login">Log in / Sign up</Link></Button>
        </div>
      </div>
    );
  }

  const name = user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "there";

  const accountItems: { icon: any; label: string; to?: AccountLink; soon?: boolean }[] = [
    { icon: Settings, label: "Account Settings", to: "/settings" },
    { icon: Package, label: "Orders", to: "/orders" },
    { icon: Mail, label: "Inbox", to: "/inbox" },
    { icon: Heart, label: "Wishlist", to: "/wishlist" },
    { icon: SearchIcon, label: "Browse Categories", to: "/categories" },
    { icon: Store, label: "Seller Hub", to: "/seller" },
    { icon: Star, label: "Ratings & Reviews", to: "/my-reviews" },
    { icon: Ticket, label: "Vouchers", to: "/vouchers" },
    { icon: Gift, label: "Invite & Earn", to: "/referrals" },
    { icon: History, label: "Recently Viewed", to: "/recently-viewed" },
  ];

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <div className="bg-marketplace-band px-5 py-6 text-marketplace-band-foreground md:px-8 md:py-8">
        <div className="flex flex-wrap items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${name}'s profile picture`}
              className="w-16 h-16 rounded-full object-cover border-2 border-border shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-marketplace-band-foreground/10 text-marketplace-band-foreground flex items-center justify-center text-2xl font-extrabold shrink-0">
              {(name ?? "K").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-teal">My account</p><h1 className="font-display text-2xl font-bold truncate">Hello, {name}</h1>
            <p className="text-xs text-marketplace-band-foreground/65 truncate">{user.email}</p>
          </div>
          <Link
            to="/settings"
            className="shrink-0 rounded-full border border-marketplace-band-foreground/25 text-marketplace-band-foreground text-xs font-bold px-4 py-2"
          >
            Edit profile
          </Link>
        </div>
        <div className="flex items-center gap-3 mt-5 border-t border-marketplace-band-foreground/20 pt-4">
          <Wallet size={22} className="text-primary" />
          <div><p className="text-xs text-marketplace-band-foreground/65">Kivora Store Credit</p><p className="mt-1 text-xl font-extrabold">GH₵ {storeCredit.toFixed(2)}</p></div><Link to="/referrals" className="ml-auto flex items-center gap-1.5 text-xs font-bold text-teal"><Gift size={16} /> Invite & Earn <ChevronRight size={14} /></Link>
        </div>
      </div>

      {isAdmin && (
        <Link to="/admin" className="flex items-center gap-3 px-4 py-3 bg-foreground text-background border-b border-border">
          <Shield size={20} />
          <span className="flex-1 font-bold">Open Admin Panel</span>
          <ChevronRight size={20} />
        </Link>
      )}

      <Link to="/seller" className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground border-b border-border">
        <Store size={20} />
        <span className="flex-1 font-bold">{isSeller ? "Open Seller Hub" : "Sell on Kivora"}</span>
        <ChevronRight size={20} />
      </Link>

      <div className="px-4 py-5 flex flex-wrap gap-3">
        <a
          href="tel:+233257573471"
          className="min-w-0 flex-1 rounded-lg bg-primary-soft text-primary py-3 flex items-center justify-center gap-2 text-sm font-bold"
        >
          <MessageSquare size={18} /> Call Support
        </a>
        <a
          href="https://wa.me/233257573471"
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 bg-success-soft text-success-ink font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm"
        >
          <MessageCircle size={18} /> WhatsApp
        </a>
      </div>

      <Section title="Need Assistance?">
        <Row icon={Info} label="Help & Support" to="/help" />
      </Section>

      <Section title="My Kivora Account">
        {accountItems.map((it) => (
          <Row key={it.label} icon={it.icon} label={it.label} to={it.to} soon={it.soon} />
        ))}
      </Section>

      <div className="mx-4 mt-6 border-t border-border">
        <Button variant="ghost" onClick={logout} className="w-full mt-3 text-center py-4 text-destructive font-bold">
          Logout
        </Button>
      </div>
      <div className="h-6" />
    </div>
  );
}

type AccountLink = "/referrals" | "/my-reviews" | "/vouchers" | "/recently-viewed" | "/help" | "/wishlist" | "/orders" | "/inbox" | "/categories" | "/seller" | "/settings";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 px-4">
      <h2 className="pb-3 text-xs text-muted-foreground font-bold uppercase">{title}</h2>
      <div className="grid md:grid-cols-2 md:gap-x-8">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, to, soon }: { icon?: any; label: string; to?: AccountLink; soon?: boolean }) {
  const content = (
    <div className="group flex items-center gap-3 py-3.5 border-b border-border text-sm transition hover:text-primary">
      {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><Icon size={19} /></span>}
      <span className="flex-1">{label}</span>
      {soon && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
          Soon
        </span>
      )}
      <ChevronRight size={20} className="text-muted-foreground" />
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return (
    <Button variant="ghost"
      className="w-full text-left"
      onClick={() => toast.info(`${label} is coming soon to Kivora.`)}
    >
      {content}
    </Button>
  );
}

