import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImageHit = { id: string; thumbnail: string; url: string; title?: string };

const SPEC_WORDS = /\b(\d+\s?(gb|tb|mb|mah|w|mm|cm|inch|in|"|ml|l|kg|g))\b|\b(new|original|brand|black|white|blue|red|green|gold|silver|grey|gray|pink|midnight|edition|pro max|dual sim)\b/gi;

/** Builds progressively broader queries: full → specs stripped → first 2 words → first word. */
export function queryVariants(term: string): string[] {
  const clean = term.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  const stripped = clean.replace(SPEC_WORDS, " ").replace(/\s+/g, " ").trim();
  const words = stripped.split(" ").filter(Boolean);
  const list = [clean, stripped, words.slice(0, 2).join(" "), words[0] ?? ""];
  return [...new Set(list.filter((q) => q.length >= 2))];
}

async function openverse(q: string): Promise<ImageHit[]> {
  try {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`, { headers: { "User-Agent": "KivoraMarketplace/1.0" } });
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: { id: string; thumbnail?: string; url: string; title?: string }[] };
    return (j.results ?? []).map((x) => ({ id: `ov-${x.id}`, thumbnail: x.thumbnail || x.url, url: x.url, title: x.title }));
  } catch { return []; }
}

async function wikimedia(q: string): Promise<ImageHit[]> {
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=24&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=400&origin=*`;
    const r = await fetch(u, { headers: { "User-Agent": "KivoraMarketplace/1.0 (https://kivoragh.shop)" } });
    if (!r.ok) return [];
    const j = (await r.json()) as { query?: { pages?: Record<string, { pageid: number; title: string; imageinfo?: { url: string; thumburl?: string; mime?: string }[] }> } };
    return Object.values(j.query?.pages ?? {})
      .filter((p) => p.imageinfo?.[0]?.mime?.startsWith("image/") && !p.imageinfo[0].mime.includes("svg"))
      .map((p) => ({ id: `wm-${p.pageid}`, thumbnail: p.imageinfo![0].thumburl || p.imageinfo![0].url, url: p.imageinfo![0].thumburl || p.imageinfo![0].url, title: p.title.replace(/^File:/, "") }));
  } catch { return []; }
}

export const searchProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").slice(0, 120) }))
  .handler(async ({ data }) => {
    for (const q of queryVariants(data.q)) {
      const [a, b] = await Promise.all([openverse(q), wikimedia(q)]);
      const seen = new Set<string>();
      const hits = [...b, ...a].filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true))).slice(0, 36);
      if (hits.length) return { hits, usedQuery: q };
    }
    return { hits: [] as ImageHit[], usedQuery: data.q };
  });

/** Copies a picked online photo into the seller's own storage so it never breaks. */
export const importProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => {
    if (!/^https:\/\//.test(d.url)) throw new Error("Invalid link");
    return { url: d.url };
  })
  .handler(async ({ data, context }) => {
    try {
      const r = await fetch(data.url, { headers: { "User-Agent": "KivoraMarketplace/1.0 (https://kivoragh.shop)" } });
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !type.startsWith("image/")) return { url: null, error: "Couldn't download that photo. Try another." };
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 8 * 1024 * 1024) return { url: null, error: "That photo is too large. Try another." };
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${context.userId}/products/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await context.supabase.storage.from("product-images").upload(path, buf, { contentType: type, upsert: false });
      if (error) { console.error("import upload", error); return { url: null, error: "Couldn't save that photo." }; }
      return { url: context.supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl, error: null };
    } catch (e) {
      console.error("import fetch", e);
      return { url: null, error: "Couldn't download that photo. Try another." };
    }
  });
