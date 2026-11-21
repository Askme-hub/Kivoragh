import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  Clock3,
  MapPin,
  PackageOpen,
  Search,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";

type FoodSeller = {
  user_id: string;
  slug: string;
  shop_name: string;
  bio: string | null;
  logo_url: string | null;
  banner_url: string | null;
  location: string | null;
  business_category: string | null;
  verification_status: string;
  product_count: number;
  accepting_orders: boolean;
  is_open_now: boolean;
  opens_at: string;
  closes_at: string;
  days_open: string[];
  default_preparation_minutes: number;
  scheduled_orders_enabled: boolean;
};

type OrderFilter = "all" | "open";

export const Route = createFileRoute("/food")({
  component: FoodDiscoveryPage,
  head: () => ({
    meta: [
      { title: "Food & Groceries in Sefwi Wiawso — Kivora" },
      {
        name: "description",
        content:
          "Discover restaurants, cooked food, groceries, bakeries and drinks from local sellers on Kivora.",
      },
      { property: "og:title", content: "Food & Groceries — Kivora" },
      {
        property: "og:description",
        content: "Browse local food sellers and their menus on Kivora.",
      },
    ],
  }),
});

function FoodDiscoveryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");

  const { data: sellers = [], isLoading, isError } = useQuery({
    queryKey: ["public-food-sellers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("public_food_sellers");
      if (error) throw error;
      return (data ?? []) as FoodSeller[];
    },
    staleTime: 60_000,
  });

  const visibleSellers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sellers.filter((seller) => {
      const matchesSearch =
        !term ||
        seller.shop_name.toLowerCase().includes(term) ||
        (seller.location ?? "").toLowerCase().includes(term) ||
        (seller.business_category ?? "").toLowerCase().includes(term) ||
        (seller.bio ?? "").toLowerCase().includes(term);
      const matchesFilter = filter === "all" || seller.is_open_now;
      return matchesSearch && matchesFilter;
    });
  }, [sellers, search, filter]);

  return (
    <div className="min-h-screen bg-background pb-10">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-flash px-4 py-9 text-primary-foreground md:rounded-3xl md:px-8 md:py-12">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            <UtensilsCrossed size={14} />
            KIVORA FOOD & GROCERIES
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
            Good food, closer to home.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary-foreground/85 md:text-base">
            Find local restaurants, cooked-food vendors, groceries, bakeries and drinks.
            Browse a seller’s menu and choose pickup or delivery when ordering.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-2">Local food sellers</span>
            <span className="rounded-full bg-white/15 px-3 py-2">Pickup or delivery</span>
            <span className="rounded-full bg-white/15 px-3 py-2">Order now or schedule</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-sm">
            <Search size={18} className="shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search food sellers, locations or type of food"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              All sellers
            </button>
            <button
              type="button"
              onClick={() => setFilter("open")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${filter === "open" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Open now
            </button>
          </div>
        </div>

        <div className="mb-3 mt-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
              Explore food sellers
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isLoading ? "Finding food sellers…" : `${visibleSellers.length} seller${visibleSellers.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-[16/8] animate-pulse bg-muted" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-10 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">Food sellers could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Please refresh and try again.</p>
          </div>
        ) : visibleSellers.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title={search ? "No matching food sellers" : "Food sellers are getting ready"}
            description={
              search
                ? "Try another seller name, location or food type."
                : "Approved sellers who activate Food & Groceries will appear here. Check back soon."
            }
            action={{ label: "Browse all Kivora categories", to: "/categories" }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSellers.map((seller) => (
              <article
                key={seller.user_id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                  {seller.banner_url || seller.logo_url ? (
                    <img
                      src={seller.banner_url || seller.logo_url || ""}
                      alt={seller.shop_name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/90 to-flash text-primary-foreground">
                      <Store size={42} />
                    </div>
                  )}
                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${seller.is_open_now ? "bg-success text-success-foreground" : "bg-card/95 text-foreground"}`}
                  >
                    {seller.is_open_now ? "Open now" : seller.accepting_orders ? "Outside opening hours" : "Not taking orders"}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      {seller.logo_url ? (
                        <img src={seller.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-primary">
                          <ChefHat size={22} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-extrabold text-foreground">{seller.shop_name}</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {seller.business_category || "Food & Groceries"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {seller.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} /> {seller.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={13} /> {seller.opens_at.slice(0, 5)}–{seller.closes_at.slice(0, 5)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PackageOpen size={13} /> {seller.product_count} menu item{seller.product_count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Clock3 size={12} className="mr-1 inline" />
                      {seller.default_preparation_minutes} min prep
                    </span>
                    {seller.scheduled_orders_enabled && (
                      <span className="rounded-lg bg-primary-soft px-2.5 py-1.5 text-[11px] font-semibold text-primary">
                        <CalendarClock size={12} className="mr-1 inline" />
                        Scheduled orders
                      </span>
                    )}
                  </div>

                  <Link
                    to="/shop/$slug"
                    params={{ slug: seller.slug }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    Browse menu <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
