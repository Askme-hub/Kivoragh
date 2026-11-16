import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Flag, Minus, Plus, Search, ShoppingBag, Truck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/lib/store";
import { orderSubtotal, type ChatOrder, type ChatOrderItem } from "@/lib/chat-product";
import { cn } from "@/lib/utils";

const ghs = (n: number) => `GH₵ ${Number(n).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;

export const REPORT_REASONS = [
  "Asking for MoMo / payment upfront",
  "Scam or fake item",
  "Harassment or offensive language",
  "Spam",
  "Other",
];

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/50" onClick={onClose}>
      <div className="mt-auto flex max-h-[85dvh] flex-col rounded-t-3xl bg-card shadow-elevated md:mx-auto md:mt-20 md:w-full md:max-w-md md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div><p className="font-bold text-foreground">{title}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ReportDialog({ open, onClose, conversationId, reporterId, reportedId, messageId, messagePreview }: {
  open: boolean; onClose: () => void; conversationId: string; reporterId: string; reportedId: string; messageId?: string | null; messagePreview?: string | null;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from("chat_reports").insert({
      reporter_id: reporterId, reported_user_id: reportedId, conversation_id: conversationId,
      message_id: messageId ?? null, reason, details: details.trim().slice(0, 1000) || null,
    });
    setBusy(false);
    if (error) return toast.error("Couldn't send report. Try again.");
    toast.success("Report sent. Our team will review it.");
    setDetails("");
    onClose();
  };
  return (
    <Sheet title={messageId ? "Report message" : "Report this chat"} sub="Reports are private — the other person won't know." onClose={onClose}>
      <div className="space-y-3 overflow-y-auto p-4">
        {messagePreview && <p className="line-clamp-3 rounded-lg border-l-4 border-flash bg-muted px-3 py-2 text-xs text-muted-foreground">{messagePreview}</p>}
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn("w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium", reason === r ? "border-flash bg-flash/10 text-foreground" : "border-border text-foreground")}>{r}</button>
          ))}
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} placeholder="Add details (optional)" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
        <button type="button" disabled={busy} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-full bg-flash py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"><Flag size={16} /> {busy ? "Sending…" : "Send report"}</button>
      </div>
    </Sheet>
  );
}

type P = { id: string; name: string; price: number; image_url: string | null; stock: number };

export function OrderBuilder({ open, onClose, sellerId, onSend }: { open: boolean; onClose: () => void; sellerId: string; onSend: (o: ChatOrder) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Record<string, ChatOrderItem>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["chat-order-products", sellerId], enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, price, image_url, stock").eq("seller_id", sellerId).eq("approval_status", "approved").gt("stock", 0).order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as P[];
    },
  });
  if (!open) return null;
  const list = (data ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const items = Object.values(sel);
  const total = orderSubtotal({ items });
  const setQty = (p: P, qty: number) => setSel((s) => {
    const n = { ...s };
    if (qty <= 0) delete n[p.id];
    else n[p.id] = { id: p.id, name: p.name, price: Number(p.price), qty: Math.min(qty, p.stock, 99), image: p.image_url };
    return n;
  });
  return (
    <Sheet title="Send an order" sub="Pick items — the buyer reviews and pays on delivery." onClose={onClose}>
      <div className="px-4 pt-3">
        <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
          <Search size={16} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your products" className="flex-1 bg-transparent text-sm text-foreground outline-none" />
        </label>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? <div className="h-16 animate-pulse rounded-xl bg-muted" /> : list.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No in-stock approved products.</p> : list.map((p) => {
          const qty = sel[p.id]?.qty ?? 0;
          return (
            <div key={p.id} className={cn("flex items-center gap-3 rounded-xl border p-2", qty ? "border-primary bg-primary-soft" : "border-border")}>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{ghs(p.price)} · {p.stock} in stock</p></div>
              {qty === 0 ? (
                <button type="button" onClick={() => setQty(p, 1)} className="rounded-full gradient-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Add</button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Less" onClick={() => setQty(p, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full border border-border bg-background"><Minus size={14} /></button>
                  <span className="w-5 text-center text-sm font-bold">{qty}</span>
                  <button type="button" aria-label="More" onClick={() => setQty(p, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full border border-border bg-background"><Plus size={14} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-4">
        <div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">{items.length} item(s) · delivery added at checkout</span><b className="text-foreground">{ghs(total)}</b></div>
        <button type="button" disabled={items.length === 0} onClick={() => { onSend({ items }); setSel({}); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-full gradient-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"><ShoppingBag size={16} /> Send order to buyer</button>
      </div>
    </Sheet>
  );
}

export function OrderCard({ order, mine, isBuyer, onConfirmed }: { order: ChatOrder; mine: boolean; isBuyer: boolean; onConfirmed: () => void }) {
  const addToCart = useShop((s) => s.addToCart);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const total = orderSubtotal(order);
  const confirm = async () => {
    setBusy(true);
    const ids = order.items.map((i) => i.id);
    const { data } = await supabase.from("products").select("id, name, price, old_price, image_url, stock, seller_id").in("id", ids).eq("approval_status", "approved");
    setBusy(false);
    const map = new Map((data ?? []).map((p) => [p.id, p]));
    let missing = 0;
    for (const it of order.items) {
      const p = map.get(it.id);
      if (!p || p.stock <= 0) { missing++; continue; }
      addToCart({ id: p.id, name: p.name, price: Number(p.price), oldPrice: p.old_price ?? undefined, image: p.image_url ?? "", stock: p.stock, sellerId: p.seller_id ?? undefined }, it.qty);
    }
    if (missing === order.items.length) return toast.error("These items are no longer available.");
    if (missing) toast.warning(`${missing} item(s) are sold out and were skipped.`);
    onConfirmed();
    navigate({ to: "/checkout" });
  };
  return (
    <div className={cn("mb-1 w-64 max-w-full overflow-hidden rounded-xl border text-foreground", mine ? "border-primary-foreground/30 bg-card" : "border-border bg-card")}>
      <div className="flex items-center gap-2 bg-primary-soft px-3 py-2 text-xs font-bold text-primary"><ShoppingBag size={14} /> Order from seller</div>
      <div className="divide-y divide-border px-3">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 py-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">{i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}</div>
            <p className="min-w-0 flex-1 truncate text-xs">{i.qty} × {i.name}</p>
            <span className="text-xs font-semibold">{ghs(i.price * i.qty)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        <div className="flex justify-between text-sm"><span>Total</span><b className="text-primary">{ghs(total)}</b></div>
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success"><Truck size={12} /> Pay on Delivery · delivery fee at checkout</p>
        {isBuyer && !mine && (
          <button type="button" disabled={busy} onClick={confirm} className="mt-2 w-full rounded-full gradient-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? "Checking…" : "Review & confirm order"}</button>
        )}
      </div>
    </div>
  );
}
