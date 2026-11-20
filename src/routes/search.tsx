import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Search, SearchX, Clock3, X, ArrowUpRight, TrendingUp, Tag, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useProducts } from "@/lib/products";
import { useCategories } from "@/lib/categories";
import { searchProducts } from "@/lib/search-match";
import { formatGHC } from "@/lib/store";
import {
  clearRecentSearches,
  getRecentSearches,
  rememberSearch,
  removeRecentSearch,
} from "@/lib/search-history";

const SearchSchema = z.object({ q: z.string().optional().default("") });
type SortOption = "relevance" | "price-low" | "price-high" | "name";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(q);
  const [recent, setRecent] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    setRecent(getRecentSearches());
    // Make the destination obvious: put the cursor straight in the search field.
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, []);

  useEffect(() => {
    setValue(q);
    setSuggestionsOpen(false);
    if (q.trim()) setRecent(rememberSearch(q));
  }, [q]);

  const matches = useMemo(() => {
    if (value.trim().length < 2) return [];
    return searchProducts(products, value.trim()).slice(0, 6);
  }, [value, products]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const matched = searchProducts(products, q);
    switch (sort) {
      case "price-low":
        return [...matched].sort((a, b) => a.price - b.price);
      case "price-high":
        return [...matched].sort((a, b) => b.price - a.price);
      case "name":
        return [...matched].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return matched;
    }
  }, [q, products, sort]);

  const popularSearches = useMemo(() => {
    const fromProducts = products.map((product) => product.category).filter((category): category is string => Boolean(category));
    return Array.from(new Set([...categories.map((category) => category.name), ...fromProducts])).slice(0, 8);
  }, [categories, products]);

  const submit = (term: string) => {
    const clean = term.trim().replace(/\s+/g, " ");
    if (!clean) return;
    setRecent(rememberSearch(clean));
    setSuggestionsOpen(false);
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

          <div className="relative">
            <form onSubmit={runSearch} className="relative z-20 flex items-center gap-2 rounded-2xl border-2 border-primary/70 bg-background p-1.5 shadow-[0_8px_24px_-14px_hsl(var(--primary)/0.45)] transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 md:rounded-full md:p-2">
              <Search size={23} className="ml-3 shrink-0 text-primary md:ml-4" />
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSuggestionsOpen(false);
                }}
                placeholder="What are you looking for today?"
                aria-label="Search products"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && value.trim().length >= 2 && matches.length > 0}
                className="h-12 min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground md:h-12 md:text-[15px]"
              />
              {value && (
                <button type="button" onClick={() => { setValue(""); setSuggestionsOpen(false); inputRef.current?.focus(); }} aria-label="Clear search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X size={18} />
                </button>
              )}
              <button type="submit" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98] md:min-w-28 md:rounded-full">
                <Search size={17} />
                <span>Search</span>
              </button>
            </form>

            {suggestionsOpen && value.trim().length >= 2 && matches.length > 0 && (
              <>
                <button type="button" aria-label="Close suggestions" className="fixed inset-0 z-10 cursor-default bg-transparent" onClick={() => setSuggestionsOpen(false)} />
                <div role="listbox" aria-label="Product suggestions" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                  <div className="border-b border-border px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Suggested products</div>
                  {matches.map((product) => (
                    <button key={product.id} type="button" role="option" aria-selected="false" onClick={() => submit(product.name)} className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition last:border-0 hover:bg-muted/70">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <Search size={17} className="text-muted-foreground" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{product.category || "Product"}</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-primary">{formatGHC(product.price)}</span>
                      <ArrowUpRight size={15} className="shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                  <button type="button" onClick={() => submit(value)} className="w-full bg-muted/40 px-4 py-3 text-center text-xs font-bold text-primary hover:bg-muted">See all results for “{value.trim()}”</button>
                </div>
              </>
            )}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">Start typing at least 2 letters to see matching products.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-3 pt-5 md:px-4 md:pt-7">
        {!q.trim() ? (
          <div className="space-y-7">
            {recent.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground"><Clock3 size={17} className="text-muted-foreground" /> Recent searches</h2>
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
                      <button type="button" onClick={() => removeHistoryItem(term)} aria-label={`Remove ${term} from recent searches`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X size={15} /></button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center gap-2"><TrendingUp size={17} className="text-primary" /><h2 className="text-sm font-extrabold text-foreground">Explore popular categories</h2></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {categories.slice(0, 8).map((category) => (
                  <Link key={category.id} to="/categories" search={{ c: category.name }} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-primary/5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-primary">{category.image_url ? <img src={category.image_url} alt="" className="h-full w-full object-cover" /> : <Tag size={18} />}</span>
                    <span className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">{category.name}</span>
                  </Link>
                ))}
              </div>
              {categories.length === 0 && <div className="flex flex-wrap gap-2">{popularSearches.map((term) => <button key={term} type="button" onClick={() => submit(term)} className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:text-primary">{term}</button>)}</div>}
            </section>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-foreground">Search results</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{isLoading ? "Finding matching products…" : `${results.length} result${results.length === 1 ? "" : "s"} for “${q}”`}</p>
              </div>
              <button type="button" onClick={() => router.navigate({ to: "/search", search: { q: "" } })} className="text-xs font-semibold text-primary hover:underline">Clear search</button>
            </div>

            {!isLoading && results.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><SlidersHorizontal size={15} /> Sort products</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} aria-label="Sort search results" className="min-w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
                  <option value="relevance">Most relevant</option>
                  <option value="price-low">Price: Low to high</option>
                  <option value="price-high">Price: High to low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 pb-6 md:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <ProductCardSkeleton key={index} />)}</div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 pb-6 md:grid-cols-4 md:gap-3">{results.map((product) => <ProductCard key={product.id} product={product} />)}</div>
            ) : (
              <EmptyState icon={SearchX} title="No products found" description={`Nothing matched “${q}”. Try another keyword or explore a category.`} action={{ label: "Browse categories", to: "/categories" }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
