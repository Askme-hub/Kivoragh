import { useSiteContent, telHref, waNumber } from "@/lib/site-content";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Phone, ChevronRight, PackageOpen, Truck, ShieldCheck, BadgeCheck, Sparkles, UtensilsCrossed, ArrowUpRight, Store, Headphones } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton, ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { BannerSlider } from "@/components/BannerSlider";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/InstallAppButton";

import { useProducts, toProduct, type DbProduct } from "@/lib/products";
import { useCategories } from "@/lib/categories";
import { useActiveFlashSale, flashPriceMap } from "@/lib/flash-sales";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/store";


export const Route = createFileRoute("/")({
  component: Home,

  head: () => ({
    meta: [
      { title: "Kivora Ghana – Everything You Need" },
      {
        name: "description",
        content:
          "Shop electronics, fashion, groceries, beauty products and more on Kivora Ghana. Fast delivery, secure payments and amazing deals.",
      },
      { property: "og:title", content: "Kivora Ghana – Everything You Need" },
      { property: "og:description", content: "Shop electronics, fashion, groceries, beauty and more on Kivora Ghana with fast delivery and secure payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Countdown({ to }: { to?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (now === null) return <span className="tabular-nums">--:--:--</span>;

  const target = to ? new Date(to).getTime() : now + 3600_000;
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      {[h, m, s].map((v, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          <span className="rounded bg-flash-foreground px-1 py-0.5 text-[12px] font-black text-flash">{pad(v)}</span>
          {i < 2 && <span className="font-black">:</span>}
        </span>
      ))}
    </span>
  );
}

/** Fetch products grouped by their category name. */
function useGroupedProducts() {
  const { data: products } = useProducts();
  const data = useMemo(() => {
    if (!products) return undefined;
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category ?? "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(p);
    }
    return groups;
  }, [products]);
  return { data };
}

function SectionHead({ title, category }: { title: string; category?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-4">
      <h2 className="truncate text-xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h2>
      <SeeAll category={category} />
    </div>
  );
}

function SeeAll({ category }: { category?: string }) {
  return (
    <Link
      to="/categories"
      search={category ? { c: category } : ({} as { c?: string })}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 md:text-sm"
    >
      See All
      <ChevronRight size={15} />
    </Link>
  );
}

function CategoryBand({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-7">
      <SectionHead title={title} category={title} />
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-3 px-4 pb-2">
          {products.slice(0, 10).map((p) => (
            <div key={p.id} className="w-[170px] shrink-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Home() {
  const site = useSiteContent();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: grouped } = useGroupedProducts();
  const { data: flashSale } = useActiveFlashSale();

  // Products in the live flash sale, with their sale price applied
  const flashMap = flashPriceMap(flashSale);
  const flashProducts: Product[] = flashSale
    ? products
        .filter((p) => flashMap.has(p.id))
        .map((p) => {
          const sp = flashMap.get(p.id) ?? p.price;
          return {
            ...p,
            oldPrice: p.price,
            price: sp,
            discount: p.price > 0 ? Math.round(((p.price - sp) / p.price) * 100) : undefined,
          };
        })
    : [];
  const displayFlash = flashProducts.length > 0 ? flashProducts : products.slice(0, 8);

  return (
    <div className="marketplace-products min-h-screen min-w-0 bg-background pb-10">
      <section className="bg-marketplace-band text-marketplace-band-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8 md:py-7">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase text-teal">Your Ghanaian marketplace</p>
            <h1 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">Kivora Ghana<span className="text-primary">.</span></h1>
            <p className="mt-1 text-xs text-marketplace-band-foreground/70 md:text-sm">Everyday essentials. Standout finds. Local sellers.</p>
          </div>
          <Button asChild size="sm" className="rounded-full"><Link to="/categories">Shop now <ArrowUpRight /></Link></Button>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-marketplace-band-foreground/15 px-5 py-2 text-[10px] font-semibold text-marketplace-band-foreground/75 md:px-8 md:text-xs">
          <span className="flex items-center gap-1.5"><Truck size={14} className="text-teal" /> All 16 regions</span>
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-teal" /> Secure checkout</span>
          <span>Prices in GH₵</span>
        </div>
      </section>
      <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0"><BannerSlider /></div>
        <aside className="hidden flex-col justify-center gap-6 border-l border-border px-5 lg:flex">
          <Link to="/seller" className="group text-foreground"><Store className="mb-3 text-primary" size={26} /><span className="block text-base font-extrabold">Grow with Kivora</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">Become a seller <ArrowUpRight size={14} /></span></Link>
          <Link to="/help" className="border-t border-border pt-5 text-foreground"><Headphones className="mb-3 text-primary" size={26} /><span className="block text-base font-extrabold">Need a hand?</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">Help & support <ArrowUpRight size={14} /></span></Link>
        </aside>
      </section>

      <div className="px-4 mt-4">
        <InstallAppButton />
      </div>

      {/* FOOD & GROCERIES ENTRY */}
      <div className="mt-5 px-4">
        <Link
          to="/food"
          className="flex items-center justify-between gap-3 overflow-hidden rounded-lg bg-teal px-4 py-4 text-teal-foreground shadow-soft transition hover:opacity-95"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-card/35">
              <UtensilsCrossed size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">Food & Groceries</span>
              <span className="mt-0.5 block text-xs text-teal-foreground/85">Discover local food sellers and browse their menus</span>
            </span>
          </span>
          <ChevronRight size={21} className="shrink-0" />
        </Link>
      </div>

      {/* TRUST STRIP */}
      <div className="mt-4 grid grid-cols-3 gap-2 px-4">
        {[
          { icon: ShieldCheck, t: "Pay on delivery", d: "Inspect first" },
          { icon: Truck, t: "16 regions", d: "Nationwide" },
          { icon: BadgeCheck, t: "Verified sellers", d: "48h protection" },
        ].map(({ icon: I, t, d }) => (
          <div key={t} className="flex flex-col items-center gap-1.5 border-b border-border px-2 py-3 text-center sm:flex-row sm:text-left">
            <I size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] font-bold text-foreground">{t}</p>
              <p className="truncate text-[10px] text-muted-foreground">{d}</p>
            </div>
          </div>
        ))}
      </div>

      {/* DELIVERY PROMO PILL */}
      <div className="mt-4 px-4">
        <Link
          to="/shipping"
          className="flex items-center justify-between gap-3 rounded-lg bg-primary-soft px-4 py-3"
        >
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            Delivery across
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-primary">all 16 regions</span>
            of Ghana
          </span>
          <Truck size={20} className="shrink-0 text-primary" />
        </Link>
      </div>

      {/* FLASH SALES */}
      <section id="flash-sales" className="mx-3 mt-7 scroll-mt-20 overflow-hidden rounded-lg bg-flash shadow-elevated md:mx-4">
        <div className="flex items-center justify-between gap-3 px-3 py-3 text-flash-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-1 truncate text-lg font-black uppercase italic tracking-tight md:text-2xl">
              <Zap size={20} fill="currentColor" className="animate-pulse" />
              {flashSale?.title ?? "Flash Sale"}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
              Ends in <Countdown to={flashSale?.ends_at} />
            </span>
          </div>
          <Link to="/categories" className="flex shrink-0 items-center gap-0.5 rounded-full bg-flash-foreground px-3 py-1.5 text-xs font-bold text-flash">
            All <ChevronRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto bg-flash/90 scrollbar-none">
          <div className="flex gap-2.5 px-3 pb-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[160px] shrink-0">
                    <ProductCardSkeleton />
                  </div>
                ))
              : displayFlash.map((p: Product) => (
                  <div key={p.id} className="w-[160px] shrink-0">
                    <ProductCard product={p} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* CALL TO ORDER */}
      <div className="mt-6 px-4">
        <a
          href={telHref(site.phone_primary)}
          className="flex items-center gap-3 rounded-lg bg-primary-soft px-4 py-3.5 shadow-soft"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-primary-foreground">
            <Phone size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-foreground">Call to order</span>
            <span className="block truncate text-xs text-muted-foreground">
              {site.phone_primary} · {site.phone_secondary}
            </span>
          </span>
        </a>
      </div>

      {/* RECOMMENDED */}
      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between gap-2 px-4">
          <h2 className="flex items-center gap-1.5 text-lg font-black uppercase tracking-tight text-foreground md:text-2xl">
            <Sparkles size={18} className="text-primary" /> Picked for you
          </h2>
          <SeeAll />
        </div>
        {isLoading ? (
          <div className="px-4">
            <ProductGridSkeleton count={10} />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No products yet"
            description="Check back soon for new arrivals and amazing deals."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-3 md:gap-3 md:px-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.slice(0, 12).map((p: Product) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* CATEGORY SECTIONS */}
      {grouped &&
        categories.map((c) => (
          <CategoryBand key={c.id} title={c.name} products={grouped.get(c.name) ?? []} />
        ))}
    </div>
  );
}

