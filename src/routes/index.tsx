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
import { useBanners } from "@/lib/banners";
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
  const { data: activeBanners = [] } = useBanners(true);
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
      {/* REFERENCE-MATCHED DESKTOP MARKETPLACE HOMEPAGE */}
      <div className="mx-auto w-full max-w-[1440px] px-3 pt-3 md:px-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[232px_minmax(0,1fr)]">
          <aside className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft lg:block">
            <Link to="/categories" className="flex items-center justify-between bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground">
              <span className="flex items-center gap-2"><span className="text-lg">☰</span> All Categories</span>
              <ChevronRight size={16} />
            </Link>
            <div className="p-2">
              {categories.slice(0, 8).map((category) => (
                <Link key={category.id} to="/categories" search={{ c: category.name }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-foreground transition hover:bg-primary-soft hover:text-primary">
                  {category.image_url ? <img src={category.image_url} alt="" className="h-6 w-6 rounded-md object-cover" /> : <span className="h-6 w-6 rounded-md bg-primary/10" />}
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                </Link>
              ))}
              <Link to="/categories" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-primary hover:bg-primary-soft">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10">▦</span>
                More Categories
                <ChevronRight size={14} className="ml-auto" />
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            <nav aria-label="Store navigation" className="mb-2 hidden items-center gap-7 px-3 text-[13px] font-bold text-foreground md:flex">
              <Link to="/" className="flex items-center gap-1.5 text-primary"><span>⌂</span> Home</Link>
              <Link to="/categories" className="hover:text-primary">Categories⌄</Link>
              <Link to="/categories" className="hover:text-primary">Deals</Link>
              <a href="#flash-sales" className="flex items-center gap-1 hover:text-primary"><Zap size={14} /> Flash Sale</a>
              <Link to="/help" className="hover:text-primary">About</Link>
              <Link to="/help" className="hover:text-primary">Blog</Link>
              <Link to="/help" className="hover:text-primary">Contact</Link>
            </nav>
            <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-primary to-amber-400 shadow-elevated">
              {activeBanners.length > 0 ? <BannerSlider /> : (
                <div className="relative flex min-h-[220px] flex-col justify-center px-6 py-8 text-white sm:min-h-[260px] sm:px-10 lg:min-h-[300px]">
                  <div className="max-w-[580px]">
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-white/85">Shop smarter. Live better.</p>
                    <h1 className="font-display text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl lg:text-6xl">Welcome to<br/><span className="text-white">Kivora!</span></h1>
                    <p className="mt-3 max-w-md text-sm font-semibold text-white/95 sm:text-base">Shop the best products at unbeatable prices. Fast delivery. Secure payments.</p>
                    <Link to="/categories" className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-extrabold text-white shadow-lg transition hover:scale-[1.02]">Start Shopping <ChevronRight size={16}/></Link>
                  </div>
                  <div className="pointer-events-none absolute bottom-4 right-5 hidden rotate-[-5deg] rounded-2xl border-2 border-white/50 bg-white/15 px-5 py-4 text-center text-xl font-black italic leading-tight text-white shadow-xl backdrop-blur-sm sm:block">Shop<br/>Smarter,<br/><span className="text-amber-100">Live Better</span></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-orange-50 px-3 py-4 dark:bg-orange-950/20 sm:grid-cols-4 sm:gap-3 sm:px-5">
          {[
            { icon: Truck, title: "Fast & Reliable Delivery", detail: "Across Ghana" },
            { icon: ShieldCheck, title: "Secure Payments", detail: "MoMo, Card & More" },
            { icon: Headphones, title: "24/7 Customer Support", detail: "We're always here" },
            { icon: BadgeCheck, title: "Easy Returns", detail: "Shop with confidence" },
          ].map(({icon: Icon,title,detail}) => (
            <div key={title} className="flex items-center gap-2.5 border-border/70 px-1 sm:gap-3 sm:border-r last:border-0 sm:px-3">
              <Icon size={27} className="shrink-0 text-primary sm:h-8 sm:w-8"/>
              <div className="min-w-0"><p className="text-[11px] font-extrabold text-foreground sm:text-xs">{title}</p><p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{detail}</p></div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[172px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)]">
          <Link to="/account" className="brand-band flex min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-primary to-amber-500 p-4 text-white shadow-elevated transition hover:-translate-y-0.5">
            <div><div className="text-3xl">👑</div><p className="mt-1 text-xl font-black">Kivora Plus</p><p className="text-xs font-semibold text-white/90">Enjoy more benefits!</p></div>
            <div className="space-y-1.5 text-[11px] font-bold"><p>✓ Exclusive Deals</p><p>✓ Priority Support</p><p>✓ Free Returns</p></div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-2 text-[11px] font-extrabold text-orange-600">Upgrade Now <ChevronRight size={13}/></span>
          </Link>

          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="border-l-4 border-primary pl-3 text-xl font-black tracking-tight text-foreground sm:text-2xl">Popular Products</h2>
              <Link to="/categories" className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary sm:text-sm">View All Products <ChevronRight size={15}/></Link>
            </div>
            {isLoading ? <ProductGridSkeleton count={5}/> : products.length === 0 ? (
              <EmptyState icon={PackageOpen} title="No products yet" description="Check back soon for new arrivals and amazing deals."/>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {products.slice(0, 10).map((p: Product) => <ProductCard key={p.id} product={p}/>)}
              </div>
            )}
          </section>
        </div>
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

