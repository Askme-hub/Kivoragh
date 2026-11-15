import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/lib/categories";
import { toast } from "sonner";
import { DEFAULT_CAMPAIGNS, POPUP_SETTINGS_KEY, type PopupCampaign, type PopupTrigger } from "@/lib/popup-campaigns";

export const Route = createFileRoute("/admin/popups")({
  component: AdminPopups,
  head: () => ({ meta: [{ title: "Pop-up Campaigns — Kivora Admin" }, { name: "robots", content: "noindex" }] }),
});

const TRIGGERS: { v: PopupTrigger; label: string; hint: string }[] = [
  { v: "cart_nudge", label: "Cart nudge", hint: "Shopper has items in cart and is about to leave or stops scrolling for 25s" },
  { v: "browsing", label: "Browsing interest", hint: "Shows after the shopper views a set number of products" },
  { v: "category", label: "Category deal", hint: "Shows to shoppers looking at a chosen category" },
];

function AdminPopups() {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-popups"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", POPUP_SETTINGS_KEY).maybeSingle();
      return Array.isArray(data?.value) ? (data!.value as unknown as PopupCampaign[]) : DEFAULT_CAMPAIGNS;
    },
  });
  const [list, setList] = useState<PopupCampaign[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setList(data); }, [data]);

  const upd = (i: number, patch: Partial<PopupCampaign>) => setList((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const add = () => setList((l) => [...l, { id: crypto.randomUUID(), title: "New offer", trigger: "browsing", min_views: 2, active: true, cta_label: "Shop now", link_url: "/" }]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("settings").upsert({ key: POPUP_SETTINGS_KEY, value: list as never, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pop-ups saved");
    qc.invalidateQueries({ queryKey: ["popup-campaigns"] });
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Pop-up campaigns</h1>
          <p className="text-sm text-muted-foreground">Each shopper sees at most one pop-up per visit, and each offer once a day.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={add} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium"><Plus className="h-4 w-4" />Add</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button>
        </div>
      </div>
      {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((c, i) => (
          <div key={c.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={c.active} onChange={(e) => upd(i, { active: e.target.checked })} />Active</label>
              <button onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Who sees it</p>
              <select className={input} value={c.trigger} onChange={(e) => upd(i, { trigger: e.target.value as PopupTrigger })}>
                {TRIGGERS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{TRIGGERS.find((t) => t.v === c.trigger)?.hint}</p>
            </div>
            {c.trigger === "category" && (
              <select className={input} value={c.category ?? ""} onChange={(e) => upd(i, { category: e.target.value })}>
                <option value="">Choose category…</option>
                {categories.map((k: { id: string; name: string }) => <option key={k.id} value={k.name}>{k.name}</option>)}
              </select>
            )}
            {c.trigger !== "cart_nudge" && (
              <label className="block text-xs text-muted-foreground">Products viewed before showing
                <input type="number" min={1} className={input} value={c.min_views ?? (c.trigger === "category" ? 1 : 2)} onChange={(e) => upd(i, { min_views: Number(e.target.value) || 1 })} />
              </label>
            )}
            <input className={input} placeholder="Headline" value={c.title} onChange={(e) => upd(i, { title: e.target.value })} />
            <input className={input} placeholder="Sub-text" value={c.subtitle ?? ""} onChange={(e) => upd(i, { subtitle: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Coupon code" value={c.code ?? ""} onChange={(e) => upd(i, { code: e.target.value.toUpperCase() })} />
              <input className={input} placeholder="Button text" value={c.cta_label ?? ""} onChange={(e) => upd(i, { cta_label: e.target.value })} />
            </div>
            <input className={input} placeholder="Button link e.g. /categories?c=Phones" value={c.link_url ?? ""} onChange={(e) => upd(i, { link_url: e.target.value })} />
            <input className={input} placeholder="Image link (optional)" value={c.image_url ?? ""} onChange={(e) => upd(i, { image_url: e.target.value })} />
            <label className="block text-xs text-muted-foreground">Ends on (optional)
              <input type="date" className={input} value={c.ends_at?.slice(0, 10) ?? ""} onChange={(e) => upd(i, { ends_at: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null })} />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
