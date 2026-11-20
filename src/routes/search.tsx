import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Search, SearchX, Clock3, X, ArrowUpRight, TrendingUp, Tag } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useProducts } from "@/lib/products";
import { useCategories } from "@/lib/categories";
import { searchProducts } from "@/lib/search-match";
import {
  clearRecentSearches,
  getRecentSearches,
  rememberSearch,
  removeRecentSearch,
} from "@/lib/search-history";

const SearchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: (s) => SearchSchema.parse(s),
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search – Kivora Ghana" }] }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const router = useRouter();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const [value, setValue] = useState(q);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  useEffect(() => {
    setValue(q);
    if (q.trim()) setRecent(rememberSearch(q));
  }, [q]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return searchProducts(products, q);
  }, [q, products]);

  const popularSearches = useMemo(() => {
    const fromProducts = products
      .map((product) => product.category)
      .filter((category): category is string => Boolean(category));
    return Array.from(new Set([...categories.map((category) => category.name), ...fromProducts])).slice(0, 8);
  }, [categories, products]);

  const submit = (term: string) => {
    const clean = term.trim().replace(/\s+/g, " ");
    if (!clean) return;
    setRecent(rememberSearch(clean));
    router.navigate({ to: "/search", search: { q: clean } });
  };

  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(value);
  };

  const removeHistoryItem = (term: string) => setRecent(removeRecentSearch(term));
  const clearHistory = () => {
    clearRecentSearches();
    setRecent([]);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <section className="border-b border-border/70 bg-card">
        <div className="mx-auto max-w-5xl px-4 pb-5 pt-5 md:pb-7 md:pt-7">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search size={19} strokeWidth={2.4} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Find what you need</h1>
              <p className="text-xs text-muted-foreground">Search millions of possibilities on Kivora</p>
            </div>
          </div>

          <form onSubmit={runSearch} className="flex items-center gap-2 rounded-2xl border-2 border-primary/70 bg-background p-1.5 shadow-[0_8px_24px_-14px_hsl(var(--primary)/0.45)] transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 md:rounded-full md:p-2">
            <Search size={23} className="ml-3 shrink-0 text-primary md:ml-4" />
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="What are you looking for today?"
              aria-label="Search products"
              className="h-12 min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground md:h-12 md:text-[15px]"
            />
            {value && (
              <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            )}
            <button type="submit" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98] md:min-w-28 md:rounded-full">
              <Search size={17} />
              <span>Search</span>
            </button>
          </form>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">Try a product name, brand or category.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-3 pt-5 md:px-4 md:pt-7">
        {!q.trim() ? (
          <div className="space-y-7">
            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                    <Clock3 size={17} className="text-muted-foreground" /> Recent searches
                  </h2>
                  <button type="button" onClick={clearHistory} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
                </div>
                <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {recent.map((term) => (
                    <div key={term} className="flex items-center gap-2 px-3 py-3 first:rounded-t-2xl last:rounded-b-2xl">
                      <button type="button" onClick={() => submit(term)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <Clock3 size={16} className="shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">{term}</span>
                        <ArrowUpRight size={15} className="ml-auto shrink-0 text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => removeHistoryItem(term)} aria-label={`Remove ${term} from recent searches`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={17} className="text-primary" />
                <h2 className="text-sm font-extrabold text-foreground">Explore popular categories</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {categories.slice(0, 8).map((category) => (
                  <Link
                    key={category.id}
                    to="/categories"
                    search={{ c: category.name }}
                    className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-primary">
                      {category.image_url ? <img src={category.image_url} alt="" className="h-full w-full object-cover" /> : <Tag size={18} />}
                    </span>
                    <span className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">{category.name}</span>
                  </Link>
                ))}
              </div>
              {categories.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((term) => (
                    <button key={term} type="button" onClick={() => submit(term)} className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:text-primary">{term}</button>
                  ))}
                </div>
              )}
            </section>

            {products.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-foreground">Popular right now</h2>
                  <span className="text-xs text-muted-foreground">Discover something new</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {popularSearches.slice(0, 8).map((term) => (
                    <button key={term} type="button" onClick={() => submit(term)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary">
                      <TrendingUp size={13} /> {term}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-foreground">Search results</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isLoading ? "Finding matching products…" : `${results.length} result${results.length === 1 ? "" : "s"} for “${q}”`}
                </p>
              </div>
              <button type="button" onClick={() => router.navigate({ to: "/search", search: { q: "" } })} className="text-xs font-semibold text-primary hover:underline">Clear search</button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 pb-6 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => <ProductCardSkeleton key={index} />)}
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 pb-6 md:grid-cols-4 md:gap-3">
                {results.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <EmptyState
                icon={SearchX}
                title="No products found"
                description={`Nothing matched “${q}”. Try another keyword or explore a category.`}
                action={{ label: "Browse categories", to: "/categories" }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
