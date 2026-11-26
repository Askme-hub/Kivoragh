import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Headphones,
  PackageOpen,
  Phone,
  ShieldCheck,
  Truck,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton, ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { BannerSlider } from "@/components/BannerSlider";
import { useSiteContent, telHref } from "@/lib/site-content";
import { useProducts } from "@/lib/products";
import { useCategories } from "@/lib/categories";
import { useBanners } from "@/lib/banners";
import { useActiveFlashSale, flashPriceMap } from "@/lib/flash-sales";
import type { Product } from "@/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Kivora Ghana – Everything You Need" },
      {
        name: "description",
        content:
          "Shop electronics, fashion, groceries, beauty products and more on Kivora Ghana. Fast delivery and secure payments.",
      },
      { property: "og:title", content: "Kivora Ghana – Everything You Need" },
      {
        property: "og:description",
        content: "Shop electronics, fashion, groceries, beauty and more on Kivora Ghana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SectionHeading({ title, to = "/categories" }: { title: string; to?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h2>
      <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline sm:text-sm">
        View all <ChevronRight size={15} />
      </Link>
    </div>
  );
}

function CategoryBand({ title, products }: { title: string; products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.slice(0, 5).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function Home() {
  const site = useSiteContent();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: activeBanners = [] } = useBanners(true);
  const { data: flashSale } = useActiveFlashSale();

  const grouped = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const product of products) {
      const category = product.category ?? "Other";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)?.push(product);
    }
    return groups;
  }, [products]);

  const flashMap = flashPriceMap(flashSale);
  const flashProducts: Product[] = flashSale
    ? products
        .filter((product) => flashMap.has(product.id))
        .map((product) => {
          const salePrice = flashMap.get(product.id) ?? product.price;
          return {
            ...product,
            oldPrice: product.price,
            price: salePrice,
            discount:
              product.price > 0
                ? Math.round(((product.price - salePrice) / product.price) * 100)
                : undefined,
          };
        })
    : [];

  const services = [
    { icon: Truck, title: "Delivery across Ghana", detail: "All 16 regions" },
    { icon: ShieldCheck, title: "Secure payments", detail: "Shop with confidence" },
    { icon: Headphones, title: "Customer support", detail: "We're here to help" },
    { icon: BadgeCheck, title: "Trusted marketplace", detail: "Verified sellers" },
  ];

  return (
    <div className="marketplace-products min-h-screen min-w-0 bg-background pb-10">
      <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6">
        {/* Main shopping area */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="hidden self-start overflow-hidden rounded-xl border border-border bg-card lg:block">
            <Link
              to="/categories"
              className="flex items-center justify-between bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              <span>All Categories</span>
              <ChevronRight size={16} />
            </Link>
            <div className="p-2">
              {categories.slice(0, 9).map((category) => (
                <Link
                  key={category.id}
                  to="/categories"
                  search={{ c: category.name }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  {category.image_url ? (
                    <img src={category.image_url} alt="" className="h-7 w-7 rounded-md object-cover" />
                  ) : (
                    <span className="h-7 w-7 rounded-md bg-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </Link>
              ))}
              <Link to="/categories" className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft">
                Browse all categories
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Compact category links for mobile */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:hidden">
              <Link to="/categories" className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                All Categories
              </Link>
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  to="/categories"
                  search={{ c: category.name }}
                  className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground"
                >
                  {category.name}
                </Link>
              ))}
            </div>

            {/* Hero: uses banners already managed from the admin area */}
            <div className="overflow-hidden rounded-xl border border-border bg-primary">
              {activeBanners.length > 0 ? (
                <BannerSlider />
              ) : (
                <div className="flex min-h-[230px] items-center px-5 py-8 text-primary-foreground sm:min-h-[290px] sm:px-10">
                  <div className="max-w-xl">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                      Your marketplace in Ghana
                    </p>
                    <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
                      Everything you need.
                      <span className="block text-white/90">All in one place.</span>
                    </h1>
                    <p className="mt-3 max-w-md text-sm text-white/90 sm:text-base">
                      Discover great products from trusted sellers across Ghana.
                    </p>
                    <Link
                      to="/categories"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-orange-50"
                    >
                      Start shopping <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Simple service information strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-4 sm:p-4">
          {services.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="flex min-w-0 items-center gap-2.5">
              <Icon size={21} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground sm:text-sm">{title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Membership and popular products */}
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
          <Link
            to="/account"
            className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-950 transition-colors hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100 dark:hover:bg-orange-950/50 md:min-h-[190px] md:flex-col md:items-start"
          >
            <div>
              <p className="text-lg font-extrabold">Kivora Plus</p>
              <p className="mt-1 text-xs text-orange-900/75 dark:text-orange-100/75">More value when you shop.</p>
              <p className="mt-3 hidden text-xs font-medium leading-6 sm:block">
                Exclusive deals<br />Priority support<br />Member benefits
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              Explore <ChevronRight size={14} />
            </span>
          </Link>

          <section className="min-w-0">
            <SectionHeading title="Popular Products" />
            {isLoading ? (
              <ProductGridSkeleton count={5} />
            ) : products.length === 0 ? (
              <EmptyState icon={PackageOpen} title="No products yet" description="Check back soon for new arrivals." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.slice(0, 10).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Live flash sale only appears when a sale is active and has products */}
        {flashSale && flashProducts.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Zap size={19} className="text-primary" /> {flashSale.title || "Flash Sale"}
              </h2>
              <Link to="/categories" className="text-xs font-semibold text-primary hover:underline">Shop deals</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {flashProducts.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Food and grocery marketplace */}
        <Link
          to="/food"
          className="mt-7 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <UtensilsCrossed size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">Food & Groceries</span>
              <span className="mt-1 block text-xs text-muted-foreground">Discover local food sellers and browse their menus.</span>
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-primary" />
        </Link>

        {/* Category-based product discovery */}
        {categories.map((category) => (
          <CategoryBand
            key={category.id}
            title={category.name}
            products={grouped.get(category.name) ?? []}
          />
        ))}

        <a
          href={telHref(site.phone_primary)}
          className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Phone size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Need help placing an order?</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              Call {site.phone_primary}{site.phone_secondary ? ` or ${site.phone_secondary}` : ""}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}
