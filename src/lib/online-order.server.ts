// Server-only: builds a pending online order with server-computed totals (shared by online payment providers).
import { doorDeliveryFee, normalizeZones, zoneForRegion } from "./delivery-zones";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type OnlineOrderInput = {
  items: { product_id?: string | null; name: string; price: number; old_price?: number | null; image_url?: string | null; qty: number }[];
  delivery: { name: string; phone: string; region: string; city: string; address: string; notes?: string; delivery_type: "door" | "pickup"; pickup_station?: string };
  coupon_code?: string;
};

export async function createPendingOnlineOrder(userId: string, data: OnlineOrderInput) {
    // Re-price every item from the database (never trust client prices)
    if (data.items.some((i) => !i.product_id)) throw new Error("Invalid cart item");
    const { data: dbProds } = await supabaseAdmin
      .from("products").select("id, name, price, old_price, image_url, stock, approval_status")
      .in("id", data.items.map((i) => i.product_id!));
    const pmap = new Map((dbProds ?? []).map((p) => [p.id, p]));
    const { data: flash } = await supabaseAdmin
      .from("flash_sale_items").select("product_id, sale_price, flash_sales!inner(active, starts_at, ends_at)")
      .in("product_id", data.items.map((i) => i.product_id!));
    const now = Date.now();
    const flashPrice = new Map<string, number>();
    for (const f of (flash ?? []) as any[]) {
      const fs = f.flash_sales;
      if (fs?.active && new Date(fs.starts_at).getTime() <= now && new Date(fs.ends_at).getTime() > now)
        flashPrice.set(f.product_id, Number(f.sale_price));
    }
    data = { ...data, items: data.items.map((i) => {
      const p = pmap.get(i.product_id!);
      if (!p || p.approval_status !== "approved") throw new Error(`${i.name} is no longer available`);
      if (p.stock < i.qty) throw new Error(`Only ${p.stock} unit(s) left for ${p.name}`);
      return { ...i, name: p.name, price: flashPrice.get(p.id) ?? Number(p.price), old_price: p.old_price, image_url: p.image_url };
    }) };

    // server-side total (don't trust client)
    const itemsTotal = data.items.reduce((a, i) => a + i.price * i.qty, 0);
    const itemCount = data.items.reduce((a, i) => a + i.qty, 0);

    // Delivery fee comes from the sellers' store settings
    const { data: zoneRows } = await supabaseAdmin.from("delivery_zones").select("*").order("sort");
    const zones = normalizeZones(zoneRows);
    const productIds = data.items.map((i) => i.product_id).filter(Boolean) as string[];
    let shipping = data.delivery.delivery_type === "pickup" ? 10 : (itemsTotal >= 150 ? 0 : zoneForRegion(data.delivery.region, zones).fee);
    if (productIds.length > 0) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("seller_id")
        .in("id", productIds);
      const sellerIds = [...new Set((prods ?? []).map((p) => p.seller_id).filter(Boolean))] as string[];
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabaseAdmin
          .from("seller_profiles")
          .select("door_delivery_fee, pickup_enabled, pickup_fee")
          .in("user_id", sellerIds);
        if (sellers && sellers.length > 0) {
          if (data.delivery.delivery_type === "pickup") {
            const p = sellers.filter((s: any) => s.pickup_enabled).reduce((a: number, s: any) => a + Number(s.pickup_fee ?? 10), 0);
            shipping = p > 0 ? p : 10;
          } else {
            shipping = doorDeliveryFee(data.delivery.region, sellers.map((s: any) => Number(s.door_delivery_fee ?? 0)), zones);
          }
        }
      }
    }
    // Coupon discount is always recomputed server-side
    let discount = 0;
    if (data.coupon_code) {
      const { computeCouponDiscount } = await import("./coupons.functions");
      const res = await computeCouponDiscount(data.coupon_code, data.items);
      if (!res.valid) throw new Error(res.message);
      discount = res.discount;
    }
    const total = Math.max(0, itemsTotal + shipping - discount);
    if (total <= 0) throw new Error("Invalid cart total");

    // fetch user email
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("email").eq("id", userId).maybeSingle();
    const email = profile?.email ?? `${userId}@user.local`;

    // create order
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        total,
        item_count: itemCount,
        status: "pending_payment",
        payment_status: "pending",
        delivery_name: data.delivery.name,
        delivery_phone: data.delivery.phone,
        delivery_region: data.delivery.region,
        delivery_city: data.delivery.city,
        delivery_address: data.delivery.address,
        delivery_notes: data.delivery.notes || null,
        delivery_type: data.delivery.delivery_type,
        pickup_station: data.delivery.pickup_station || null,
        shipping_fee: shipping,
        delivery_zone: data.delivery.delivery_type === "pickup" ? null : zoneForRegion(data.delivery.region, zones).id,
        discount,
        coupon_code: data.coupon_code ? data.coupon_code.trim().toUpperCase() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // insert items
    const { error: ie } = await supabaseAdmin.from("order_items").insert(
      data.items.map((i) => ({ ...i, order_id: order.id }))
    );
    if (ie) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(ie.message);
    }

    return { order, total, email };
}
