import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHC } from "@/lib/store";

export const Route = createFileRoute("/orders/")({
  component: Orders,
  head: () => ({ meta: [{ title: "My Orders – Kivora Ghana" }, { name: "description", content: "View purchases, food orders and delivery updates from Kivora Ghana." }, { property: "og:title", content: "My Orders – Kivora Ghana" }, { property: "og:description", content: "Track your Kivora purchases and food orders." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
});

const statusLabel: Record<string, { text: string; tone: string }> = {
  pending_payment: { text: "AWAITING PAYMENT", tone: "bg-warning-soft text-warning-ink" },
  placed: { text: "ORDER PLACED", tone: "bg-primary-soft text-primary" },
  pending_confirmation: { text: "PENDING", tone: "bg-warning-soft text-warning-ink" },
  waiting_to_be_shipped: { text: "PROCESSING", tone: "bg-info-soft text-info-ink" },
  shipped: { text: "SHIPPED", tone: "bg-info-soft text-info-ink" },
  available_for_pickup: { text: "READY FOR PICKUP", tone: "bg-info-soft text-info-ink" },
  delivered: { text: "DELIVERED", tone: "bg-success-soft text-success-ink" },
  accepted: { text: "ACCEPTED", tone: "bg-info-soft text-info-ink" },
  preparing: { text: "PREPARING", tone: "bg-info-soft text-info-ink" },
  ready_for_pickup: { text: "READY FOR PICKUP", tone: "bg-info-soft text-info-ink" },
  out_for_delivery: { text: "OUT FOR DELIVERY", tone: "bg-info-soft text-info-ink" },
  completed: { text: "COMPLETED", tone: "bg-success-soft text-success-ink" },
  cancelled: { text: "CANCELLED", tone: "bg-danger-soft text-danger-ink" },
};

function Orders() {
  const [tab, setTab] = useState<"ongoing" | "cancelled">("ongoing");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, item_count, created_at, order_items(name, image_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const orders = data ?? [];
      const orderIds = orders.map((order) => order.id);
      if (orderIds.length === 0) return [];
      const { data: foodRows, error: foodError } = await (supabase as any)
        .from("food_order_details")
        .select("order_id, status")
        .in("order_id", orderIds);
      if (foodError) throw foodError;
      const foodStatusByOrder = new Map(
        (foodRows ?? []).map((row: { order_id: string; status: string }) => [row.order_id, row.status])
      );
      return orders.map((order) => ({
        ...order,
        display_status: order.status === "cancelled"
          ? "cancelled"
          : (foodStatusByOrder.get(order.id) ?? order.status),
      }));
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const filtered = (data ?? []).filter((o) =>
    tab === "cancelled" ? o.status === "cancelled" : o.status !== "cancelled"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold uppercase text-primary">My purchases</p><h1 className="font-display text-3xl font-bold">Orders</h1></div><ShoppingBag size={28} className="text-primary" /></div>

      <div className="mb-5 flex gap-2 border-b border-border">
        {(["ongoing", "cancelled"] as const).map((t) => (
          <Button variant="ghost"
            key={t}
            onClick={() => setTab(t)}
            className={`h-auto flex-1 rounded-none px-2 py-3 text-xs font-bold sm:text-sm ${
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "ongoing" ? "Ongoing & delivered" : "Cancelled & returned"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="p-6 text-center text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center"><Package size={40} className="mx-auto mb-4 text-muted-foreground" /><h2 className="text-lg font-bold">No orders here yet</h2><p className="mt-2 text-sm text-muted-foreground">Your purchases will appear here.</p><Button asChild className="mt-5 rounded-full"><Link to="/categories">Browse products <ChevronRight /></Link></Button></div>
      ) : (
        filtered.map((o) => {
          const first = o.order_items?.[0];
          const lab = statusLabel[String(o.display_status)] ?? { text: "ORDER PLACED", tone: "bg-primary-soft text-primary" };
          return (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: String(o.id) }}
              className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-soft transition hover:border-primary/35 sm:p-4"
            >
              <div className="w-16 h-16 bg-product-backdrop shrink-0 rounded-md sm:h-20 sm:w-20">
                {first?.image_url && (
                  <img src={first.image_url} alt="" loading="lazy" className="w-full h-full object-contain" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{first?.name ?? "Order"}{o.item_count > 1 ? <span className="font-normal text-muted-foreground"> +{o.item_count - 1} more</span> : null}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Order #{o.order_number}</p>
                <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs font-bold rounded ${lab.tone}`}>
                  {lab.text}
                </span>
                <p className="text-xs mt-1 text-muted-foreground">On {new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 text-sm font-extrabold text-foreground whitespace-nowrap self-center">{formatGHC(Number(o.total))}<ChevronRight size={16} className="text-muted-foreground" /></div>
            </Link>
          );
        })
      )}
      <div className="h-6" />
    </div>
  );
}
