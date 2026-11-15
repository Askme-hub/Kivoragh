import { PushToggle } from "@/components/PushToggle";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Package, Clock, CheckCircle2, Store, MessageCircle, ShoppingBag, Wallet, Plus, AlertTriangle, ChevronRight, Share2, ExternalLink, TrendingUp, Star, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsSeller, useSellerProfile } from "@/hooks/use-seller";
import { SellerVerification } from "@/components/SellerVerification";
import { formatGHC } from "@/lib/store";
import { getSellerOrders } from "@/lib/seller-orders.functions";
import { getSellerAnalytics } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seller/")({
  component: SellerDashboard,
  head: () => ({ meta: [
    { title: "Seller Overview — Kivora Ghana" },
    { name: "description", content: "Track your Kivora shop performance, orders, inventory and wallet." },
    { property: "og:title", content: "Seller Overview — Kivora Ghana" },
    { property: "og:description", content: "Your Kivora seller business overview." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function SellerDashboard() {
  const { user } = useAuth();
  const { data: isSeller, isLoading: roleLoading } = useIsSeller(user);
  const { data: profile, isLoading: profileLoading, refetch } = useSellerProfile(user);

  if (!user) return <div className="p-6 text-sm">Please log in.</div>;
  if (roleLoading || profileLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!isSeller && !profile) return <ApplyForm onApplied={() => refetch()} userId={user.id} />;

  if (!isSeller && profile?.status === "pending") {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <Clock size={48} className="mx-auto text-warning-ink" />
        <h2 className="mt-4 text-xl font-bold">Application Pending</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Your seller application for <strong>{profile.shop_name}</strong> is under review.
          You'll be able to upload products once an admin approves you.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild><Link to="/"><ShoppingBag /> Continue shopping</Link></Button>
          <Button asChild variant="outline"><Link to="/categories">Browse categories</Link></Button>
        </div>
      </div>
    );
  }

  if (!isSeller && profile?.status === "suspended") {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-xl font-bold text-destructive">Account Suspended</h2>
        <p className="text-muted-foreground mt-2 text-sm">Contact support to restore your seller access.</p>
      </div>
    );
  }

  return (
    <div>
      {profile && (
        <div className="p-4 pb-0">
          <SellerVerification
            userId={user.id}
            status={profile.status}
            verificationStatus={(profile as any).verification_status ?? "not_verified"}
            onChanged={() => refetch()}
          />
        </div>
      )}
      <Overview userId={user.id} shopName={profile?.shop_name ?? "Your shop"} slug={(profile as any)?.slug ?? null} />
    </div>
  );
}

function Overview({ userId, shopName, slug }: { userId: string; shopName: string; slug: string | null }) {
  const fetchOrders = useServerFn(getSellerOrders);
  const { data: products } = useQuery({
    queryKey: ["seller-products-summary", userId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, price, approval_status, stock").eq("seller_id", userId);
      return data ?? [];
    },
  });
  const { data: wallet } = useQuery({
    queryKey: ["seller-dashboard-wallet", userId],
    queryFn: async () => {
      const { data } = await supabase.from("seller_wallets").select("balance, pending, total_earned").eq("user_id", userId).maybeSingle();
      return data;
    },
  });
  const { data: orders = [] } = useQuery({ queryKey: ["seller-dashboard-orders", userId], queryFn: () => fetchOrders() });
  const fetchAnalytics = useServerFn(getSellerAnalytics);
  const { data: analytics } = useQuery({ queryKey: ["seller-analytics", userId], queryFn: () => fetchAnalytics() });

  const approved = products?.filter((p) => p.approval_status === "approved").length ?? 0;
  const pendingProducts = products?.filter((p) => p.approval_status === "pending").length ?? 0;
  const lowStock = products?.filter((p) => p.approval_status === "approved" && (p.stock ?? 0) <= 3) ?? [];
  const st = (o: any) => String(o.status).toLowerCase();
  const toPack = orders.filter((o) => ["placed", "pending", "processing", "confirmed"].includes(st(o))).length;
  const onTheWay = orders.filter((o) => ["shipped", "out_for_delivery", "in_transit"].includes(st(o))).length;
  const delivered = orders.filter((o) => ["delivered", "completed"].includes(st(o))).length;
  const recentOrders = orders.slice(0, 6);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const kpis = [
    { label: "Sales · 30 days", value: formatGHC(analytics?.totalRevenue ?? 0), icon: TrendingUp },
    { label: "Orders · 30 days", value: String(analytics?.totalOrders ?? 0), icon: ShoppingBag },
    { label: "Live products", value: String(approved), icon: Package },
    { label: "Pending payout", value: formatGHC(Number(wallet?.pending ?? 0)), icon: Clock },
  ];
  const tools = [
    { to: "/seller/products/new" as const, label: "Add product", icon: Plus },
    { to: "/seller/orders" as const, label: "Orders", icon: ShoppingBag },
    { to: "/seller/products" as const, label: "Products", icon: Package },
    { to: "/seller/pos" as const, label: "POS", icon: Store },
    { to: "/seller/messages" as const, label: "Messages", icon: MessageCircle },
    { to: "/seller/wallet" as const, label: "Wallet", icon: Wallet },
    { to: "/seller/reviews" as const, label: "Reviews", icon: Star },
    { to: "/seller/profile" as const, label: "Shop profile", icon: Settings },
  ];
  const pipeline = [
    { label: "To pack", value: toPack, tone: "bg-warning/15 text-warning-ink" },
    { label: "On the way", value: onTheWay, tone: "bg-primary/10 text-primary" },
    { label: "Delivered", value: delivered, tone: "bg-success/15 text-success" },
  ];
  const tasks = [
    toPack > 0 && { to: "/seller/orders" as const, title: `${toPack} order${toPack === 1 ? "" : "s"} to pack`, hint: "Buyers are waiting — ship today", icon: ShoppingBag, warn: true },
    lowStock.length > 0 && { to: "/seller/products" as const, title: `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} running low`, hint: lowStock.slice(0, 2).map((p) => p.name).join(", "), icon: AlertTriangle, warn: true },
    pendingProducts > 0 && { to: "/seller/products" as const, title: `${pendingProducts} product${pendingProducts === 1 ? "" : "s"} in review`, hint: "Admin is checking them", icon: Clock, warn: false },
    approved === 0 && { to: "/seller/products/new" as const, title: "List your first product", hint: "Shops with 5+ products sell more", icon: Plus, warn: false },
  ].filter(Boolean) as { to: any; title: string; hint: string; icon: any; warn: boolean }[];

  return (
    <div className="dashboard-canvas mx-auto max-w-7xl space-y-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-foreground/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-primary-foreground/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold opacity-85">{greeting} 👋</p>
            <h1 className="mt-1 truncate font-display text-2xl font-extrabold tracking-tight md:text-4xl">{shopName}</h1>
            <p className="mt-1.5 text-sm opacity-90">Here's how your shop is doing today.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to="/seller/products/new"><Plus /> Add product</Link>
              </Button>
              {slug && (
                <>
                  <Button asChild size="sm" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Shop ${shopName} on Kivora 🛍️ https://kivoragh.shop/shop/${slug}`)}`} target="_blank" rel="noreferrer"><Share2 /> Share</a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                    <Link to="/shop/$slug" params={{ slug }}><ExternalLink /> View shop</Link>
                  </Button>
                </>
              )}
              <PushToggle />
            </div>
          </div>
          <Link to="/seller/wallet" className="group shrink-0 rounded-2xl bg-primary-foreground/15 p-4 backdrop-blur transition hover:bg-primary-foreground/20 lg:min-w-64">
            <p className="flex items-center gap-1.5 text-xs font-semibold opacity-85"><Wallet className="h-3.5 w-3.5" /> Available balance</p>
            <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">{formatGHC(Number(wallet?.balance ?? 0))}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-bold">Withdraw to MoMo <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></p>
          </Link>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4.5 w-4.5" /></span>
              <p className="mt-3 truncate font-display text-xl font-extrabold tracking-tight md:text-2xl">{k.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tools */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <h2 className="px-1 pb-3 text-sm font-bold">Seller tools</h2>
        <div className="grid grid-cols-4 gap-1 sm:gap-2 lg:grid-cols-8">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to} className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition hover:bg-muted/50 active:scale-95">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary sm:h-12 sm:w-12"><Icon className="h-5 w-5" /></span>
                <span className="text-[11px] font-semibold leading-tight sm:text-xs">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Orders */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold">Orders</h2>
            <Link to="/seller/orders" className="text-xs font-semibold text-primary">See all</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-border p-3">
            {pipeline.map((p) => (
              <div key={p.label} className={`rounded-xl px-3 py-2.5 ${p.tone}`}>
                <p className="font-display text-xl font-extrabold">{p.value}</p>
                <p className="text-[11px] font-semibold">{p.label}</p>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <Link key={order.id} to="/seller/orders/$id" params={{ id: order.id }} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><ShoppingBag className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{order.items?.map((item: any) => item.name).join(", ") || "Order"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">#{order.order_number} · {new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold">{formatGHC(order.subtotal)}</p>
                  <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{order.status}</span>
                </div>
              </Link>
            ))}
            {recentOrders.length === 0 && (
              <div className="px-4 py-10 text-center">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-semibold">No orders yet</p>
                <p className="text-xs text-muted-foreground">Share your shop on WhatsApp to get your first sale.</p>
              </div>
            )}
          </div>
        </section>

        {/* To-do */}
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold">Needs your attention</h2>
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
              <p className="mt-2 text-sm font-bold">All caught up</p>
              <p className="text-xs text-muted-foreground">Nothing needs action right now.</p>
            </div>
          ) : tasks.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.title} to={t.to} className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition active:scale-[0.99] ${t.warn ? "border-warning/30 bg-warning/5 hover:bg-warning/10" : "border-border bg-card hover:bg-muted/30"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.warn ? "bg-warning/20 text-warning-ink" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground">Total earned on Kivora</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{formatGHC(Number(wallet?.total_earned ?? 0))}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

const STEPS = ["Country", "Account", "Personal", "Review"];

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((_, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div
            className={`w-3.5 h-3.5 rounded-full transition ${
              i <= step ? "bg-primary" : "bg-muted border border-border"
            }`}
          />
          {i < STEPS.length - 1 && (
            <div
              className={`h-1 flex-1 rounded-full transition ${
                i < step ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ApplyForm({ userId, onApplied }: { userId: string; onApplied: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("Ghana");
  const [shop, setShop] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const apply = async () => {
    if (!shop.trim()) {
      setStep(1);
      return toast.error("Shop name is required");
    }
    setBusy(true);
    const { error } = await supabase.from("seller_profiles").insert({
      user_id: userId,
      shop_name: shop.trim(),
      bio: bio.trim() || null,
      phone: phone.trim() || null,
      status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted! Admin will review shortly.");
    onApplied();
  };

  const titles = [
    { h: "Sell on Kivora", s: "Choose the country of your shop" },
    { h: "Setup your account", s: "Provide your shop name and email" },
    { h: "Personal Information", s: "Add your contact details" },
    { h: "Review & submit", s: "Confirm your details to finish" },
  ];

  const field =
    "w-full border-2 border-border focus:border-primary rounded-xl px-4 py-3 outline-none bg-card transition";

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <Stepper step={step} />
        <h2 className="text-2xl font-extrabold text-foreground">{titles[step].h}</h2>
        <p className="text-muted-foreground text-sm mt-1">{titles[step].s}</p>

        <div className="mt-5 space-y-3">
          {step === 0 && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Select your country *
              </span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`${field} mt-1`}
              >
                <option>Ghana</option>
                <option>Nigeria</option>
                <option>Kenya</option>
                <option>Côte d'Ivoire</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Only for sellers registered &amp; selling in their own country.
              </p>
            </label>
          )}

          {step === 1 && (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  Email Address *
                </span>
                <input
                  value={user?.email ?? ""}
                  readOnly
                  className={`${field} mt-1 bg-muted text-muted-foreground`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  Shop name *
                </span>
                <input
                  placeholder="e.g. Kofi Electronics"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  Phone number
                </span>
                <div className="mt-1 flex gap-2">
                  <span className="flex items-center px-4 rounded-xl border-2 border-border bg-muted font-semibold text-sm">
                    +233
                  </span>
                  <input
                    placeholder="24 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={field}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  About your shop
                </span>
                <textarea
                  placeholder="Tell buyers about your shop"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className={`${field} mt-1`}
                />
              </label>
            </>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm">
              <Row label="Country" value={country} />
              <Row label="Email" value={user?.email ?? "—"} />
              <Row label="Shop name" value={shop || "—"} />
              <Row label="Phone" value={phone ? `+233 ${phone}` : "—"} />
              <p className="text-xs text-muted-foreground pt-2">
                Once submitted, an admin will review and approve your shop.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={back}
              className="flex-1 border-2 border-border rounded-xl py-3 font-bold text-foreground hover:bg-muted transition"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              disabled={step === 1 && !shop.trim()}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-50 transition"
            >
              Next
            </button>
          ) : (
            <button
              onClick={apply}
              disabled={busy}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-bold disabled:opacity-60 transition"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}
