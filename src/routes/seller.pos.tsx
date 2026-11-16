import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Calculator, Package, Receipt, Upload, Maximize, Minimize,
  Volume2, VolumeX, FileText, X, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PosSell } from "@/components/pos/PosSell";
import { PosInventory } from "@/components/pos/PosInventory";
import { PosSales } from "@/components/pos/PosSales";
import { PosImport } from "@/components/pos/PosImport";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatGHC } from "@/lib/store";
import { isPosSoundOn, setPosSound } from "@/lib/pos-sound";
import { toast } from "sonner";

export const Route = createFileRoute("/seller/pos")({
  component: PosDashboard,
  head: () => ({
    meta: [
      { title: "POS Terminal — Kivora Seller" },
      { name: "description", content: "Full-screen point of sale, inventory and walk-in sales for your shop." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Tab = "sell" | "inventory" | "sales" | "import";
const TABS: { id: Tab; label: string; icon: typeof Calculator }[] = [
  { id: "sell", label: "Sell", icon: Calculator },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "sales", label: "Sales", icon: Receipt },
  { id: "import", label: "Import", icon: Upload },
];

function PosDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("sell");
  const [now, setNow] = useState<Date | null>(null);
  const [sound, setSound] = useState(true);
  const [full, setFull] = useState(false);
  const [zOpen, setZOpen] = useState(false);

  useEffect(() => {
    setSound(isPosSoundOn());
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => { clearInterval(t); document.removeEventListener("fullscreenchange", onFs); };
  }, []);

  const { data: shop } = useQuery({
    queryKey: ["pos-shop", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("seller_profiles")
        .select("shop_name, phone, whatsapp_number, location, slug, logo_url")
        .eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast.error("Full screen isn't supported on this device"); }
  };

  return (
    <div className="dashboard-canvas flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5 md:px-5">
          <Link to="/seller" className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted" aria-label="Back to Seller Hub">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {shop?.logo_url ? (
              <img src={shop.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
                {(shop?.shop_name ?? "K").charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{shop?.shop_name ?? "My shop"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                POS Terminal{now ? ` · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setZOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" title="Today's report">
            <FileText className="h-4 w-4" /><span className="hidden sm:inline">Day report</span>
          </button>
          <button type="button" onClick={() => { setPosSound(!sound); setSound(!sound); }} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted" aria-label={sound ? "Mute scanner sound" : "Turn on scanner sound"}>
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button type="button" onClick={toggleFull} className="hidden h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted sm:grid" aria-label="Toggle full screen">
            {full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 scrollbar-none md:px-5" aria-label="POS sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </header>

      <main key={tab} className="flex-1">
        {tab === "sell" && <PosSell />}
        {tab === "inventory" && <PosInventory />}
        {tab === "sales" && <PosSales />}
        {tab === "import" && <PosImport />}
      </main>

      {zOpen && <DayReport shopName={shop?.shop_name ?? "My shop"} onClose={() => setZOpen(false)} />}
    </div>
  );
}

type Sale = { total: number; discount: number; payment_method: string; items: { name: string; qty: number; price: number }[]; created_at: string };

function DayReport({ shopName, onClose }: { shopName: string; onClose: () => void }) {
  const { user } = useAuth();
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["pos-day-report", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from("pos_sales")
        .select("total, discount, payment_method, items, created_at")
        .eq("seller_id", user!.id).gte("created_at", start.toISOString());
      if (error) throw error;
      return data as unknown as Sale[];
    },
  });
  const total = sales.reduce((a, s) => a + Number(s.total), 0);
  const disc = sales.reduce((a, s) => a + Number(s.discount), 0);
  const by = (m: string) => sales.filter((s) => s.payment_method === m).reduce((a, s) => a + Number(s.total), 0);
  const items = new Map<string, { qty: number; amt: number }>();
  sales.forEach((s) => s.items.forEach((i) => {
    const c = items.get(i.name) ?? { qty: 0, amt: 0 };
    items.set(i.name, { qty: c.qty + i.qty, amt: c.amt + i.qty * Number(i.price) });
  }));
  const top = [...items.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const rows: [string, string][] = [
    ["Sales", String(sales.length)], ["Cash", formatGHC(by("cash"))], ["MoMo", formatGHC(by("momo"))],
    ["Card", formatGHC(by("card"))], ["Discounts given", formatGHC(disc)],
  ];
  const print = () => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return toast.error("Allow pop-ups to print");
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    w.document.write(`<html><head><title>Day report</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial;width:72mm;font-size:12px}.r{display:flex;justify-content:space-between;padding:2px 0}h2,p{text-align:center;margin:4px 0}hr{border:0;border-top:1px dashed #999}</style></head><body>
      <h2>${esc(shopName)}</h2><p>END OF DAY REPORT<br>${new Date().toLocaleString()}</p><hr>
      ${rows.map(([k, v]) => `<div class="r"><span>${k}</span><span>${v}</span></div>`).join("")}
      <hr><div class="r"><b>TOTAL</b><b>${formatGHC(total)}</b></div><hr><p><b>Top items</b></p>
      ${top.map(([n, v]) => `<div class="r"><span>${esc(n)} ×${v.qty}</span><span>${formatGHC(v.amt)}</span></div>`).join("")}
      <hr><p>Powered by Kivora</p><script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
    w.document.close();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">End of day</p>
            <h3 className="text-lg font-bold">Today's report</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
          <>
            <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs opacity-80">Total collected</p>
              <p className="font-display text-3xl font-bold">{formatGHC(total)}</p>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            <h4 className="mt-5 mb-2 text-sm font-bold">Top sellers today</h4>
            {top.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet today.</p> : (
              <ul className="space-y-1.5 text-sm">
                {top.map(([n, v]) => (
                  <li key={n} className="flex justify-between gap-2"><span className="truncate">{n} × {v.qty}</span><span className="font-semibold">{formatGHC(v.amt)}</span></li>
                ))}
              </ul>
            )}
            <button type="button" onClick={print} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              <Printer className="h-4 w-4" /> Print day report
            </button>
          </>
        )}
      </div>
    </div>
  );
}
