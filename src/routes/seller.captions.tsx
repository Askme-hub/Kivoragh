import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateCaptions } from "@/lib/captions.functions";

export const Route = createFileRoute("/seller/captions")({
  component: CaptionStudio,
  head: () => ({ meta: [
    { title: "AI Caption Studio — Kivora Seller Hub" },
    { name: "description", content: "Create share-ready promo captions for Ghanaian buyers." },
    { name: "robots", content: "noindex" },
  ] }),
});

const TONES = ["Friendly", "Exciting", "Premium", "Funny", "Urgent sale"];

function CaptionStudio() {
  const run = useServerFn(generateCaptions);
  const [listing, setListing] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [loading, setLoading] = useState(false);
  const [captions, setCaptions] = useState<{ platform: string; text: string }[]>([]);

  async function go() {
    if (listing.trim().length < 3 || audience.trim().length < 2) return toast.error("Add your product and who it's for");
    setLoading(true);
    try {
      const r = await run({ data: { listing, audience, tone } });
      if (r.error) toast.error(r.error); else setCaptions(r.captions);
    } catch { toast.error("Something went wrong. Try again."); }
    finally { setLoading(false); }
  }
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };
  const wa = (t: string) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5" /> AI Caption Studio</h1>
        <p className="mt-1 text-sm opacity-90">Describe your product and buyers — get ready-to-post captions for WhatsApp, Instagram, TikTok and Facebook.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <label className="block text-sm font-semibold">Product listing
            <textarea value={listing} onChange={(e) => setListing(e.target.value)} maxLength={1500} rows={6}
              placeholder="e.g. iPhone 13 128GB, UK used, 90% battery, GH₵ 5,200, comes with charger"
              className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal" />
          </label>
          <label className="block text-sm font-semibold">Target audience
            <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300}
              placeholder="e.g. students in Kumasi, young professionals in Accra"
              className="mt-1 w-full rounded-xl border bg-background p-3 text-sm font-normal" />
          </label>
          <div>
            <p className="text-sm font-semibold">Tone</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button key={t} onClick={() => setTone(t)}
                  className={`rounded-full border px-3 py-1 text-xs ${tone === t ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{t}</button>
              ))}
            </div>
          </div>
          <button onClick={go} disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {loading ? "Writing captions…" : "Create captions"}
          </button>
        </div>
        <div className="space-y-3">
          {captions.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Your captions will appear here.</div>
          )}
          {loading && [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
          {captions.map((c, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-bold uppercase text-primary">{c.platform}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{c.text}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => copy(c.text)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Copy className="h-3 w-3" /> Copy</button>
                <button onClick={() => wa(c.text)} className="flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs text-success-foreground"><Share2 className="h-3 w-3" /> WhatsApp</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
