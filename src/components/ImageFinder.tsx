import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importProductImage, searchProductImages, type ImageHit } from "@/lib/image-search.functions";

const CHIPS = ["Phone", "Sneakers", "Watch", "Bag", "Laptop", "Dress", "Headphones"];

export function ImageFinder({ initialQuery, onPick, onClose }: { initialQuery: string; onPick: (url: string) => void; onClose: () => void }) {
  const searchFn = useServerFn(searchProductImages);
  const importFn = useServerFn(importProductImage);
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<ImageHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const search = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true); setErr(""); setNote("");
    try {
      const res = await searchFn({ data: { q: term } });
      setHits(res.hits);
      if (!res.hits.length) setErr("No photos found. Try a shorter name, like the brand only.");
      else if (res.usedQuery.toLowerCase() !== term.trim().toLowerCase()) setNote(`Showing photos for “${res.usedQuery}”`);
    } catch {
      setErr("Couldn't search right now. Please try again.");
    }
    setLoading(false);
  };

  const pick = async (h: ImageHit) => {
    setSaving(h.id);
    try {
      const res = await importFn({ data: { url: h.url } });
      if (res.url) { onPick(res.url); setAdded((s) => new Set(s).add(h.id)); }
      else toast.error(res.error ?? "Couldn't add that photo");
    } catch { toast.error("Couldn't add that photo"); }
    setSaving(null);
  };

  useEffect(() => { void search(initialQuery); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-foreground/50 md:items-center" onClick={onClose}>
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-card md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="font-bold">Find photos online</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
        <form className="flex gap-2 px-4 pt-4" onSubmit={(e) => { e.preventDefault(); void search(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Infinix Hot 40" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit"><Search /> Search</Button>
        </form>
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => { setQ(c); void search(c); }} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-primary hover:text-primary">{c}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : err ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{err}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {hits.map((h) => (
                <button key={h.id} type="button" disabled={!!saving} onClick={() => void pick(h)} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted hover:border-primary disabled:opacity-70">
                  <img src={h.thumbnail} alt={h.title ?? ""} loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                  {(saving === h.id || added.has(h.id)) && (
                    <span className="absolute inset-0 grid place-items-center bg-foreground/40 text-primary-foreground">
                      {saving === h.id ? <Loader2 className="animate-spin" /> : <Check />}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Tap a photo to add it. Real photos of your own item build more trust with buyers.</p>
        </div>
      </div>
    </div>
  );
}
