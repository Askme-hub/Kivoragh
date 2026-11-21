import type { SupabaseClient } from "@supabase/supabase-js";

type FoodCheckoutItem = { product_id?: string | null; qty: number };
type FoodCheckoutDelivery = { delivery_type: "door" | "pickup" };
type FoodCheckoutOptions = { scheduled_for?: string | null } | undefined;

function ghanaParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: get("weekday").toLowerCase(),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isWithinOpeningHours(
  value: Date,
  settings: { opens_at: string; closes_at: string; days_open: string[] },
) {
  const { day, minutes } = ghanaParts(value);
  const days = settings.days_open ?? [];
  if (!days.includes(day)) return false;
  const toMinutes = (time: string) => {
    const [hours, mins] = time.slice(0, 5).split(":").map(Number);
    return hours * 60 + mins;
  };
  const opens = toMinutes(settings.opens_at);
  const closes = toMinutes(settings.closes_at);
  return opens <= closes
    ? minutes >= opens && minutes < closes
    : minutes >= opens || minutes < closes;
}

/**
 * Detects food orders from authoritative product ownership and food seller settings.
 * A cart containing any opted-in food seller must contain products from that seller only.
 */
export async function validateFoodCheckout(
  supabaseAdmin: SupabaseClient,
  items: FoodCheckoutItem[],
  delivery: FoodCheckoutDelivery,
  options: FoodCheckoutOptions,
) {
  if (items.some((item) => !item.product_id)) throw new Error("Invalid cart item");

  const productIds = items.map((item) => item.product_id!) ;
  const { data: products, error: productsError } = await supabaseAdmin
    .from("products")
    .select("id, seller_id")
    .in("id", productIds);
  if (productsError) throw new Error(productsError.message);

  if (!products || products.length !== items.length) throw new Error("One or more products are no longer available.");
  const sellerIds = [...new Set((products ?? []).map((product: any) => product.seller_id).filter(Boolean))] as string[];
  if (sellerIds.length === 0) return null;

  const { data: foodSettings, error: settingsError } = await supabaseAdmin
    .from("food_seller_settings")
    .select("seller_id,is_food_seller,accepting_orders,opens_at,closes_at,days_open,default_preparation_minutes,scheduled_orders_enabled")
    .in("seller_id", sellerIds)
    .eq("is_food_seller", true);
  if (settingsError) throw new Error(settingsError.message);
  if (!foodSettings?.length) return null;

  if (sellerIds.length !== 1 || foodSettings.length !== 1 || sellerIds[0] !== foodSettings[0].seller_id || products.some((product: any) => product.seller_id !== foodSettings[0].seller_id)) {
    throw new Error("Food orders must contain products from one food seller only. Please remove items from other shops and place a separate order.");
  }

  const settings = foodSettings[0];
  if (!settings.accepting_orders) {
    throw new Error("This food seller is not accepting orders right now.");
  }

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from("seller_profiles")
    .select("door_delivery_fee,pickup_enabled,pickup_station,pickup_region,pickup_fee")
    .eq("user_id", settings.seller_id)
    .maybeSingle();
  if (sellerError) throw new Error(sellerError.message);

  if (delivery.delivery_type === "pickup" && (!seller?.pickup_enabled || !seller?.pickup_station)) {
    throw new Error("This food seller does not currently offer pickup. Please choose door delivery.");
  }

  const prepMinutes = Number(settings.default_preparation_minutes ?? 30);
  let requestedFor: string | null = null;
  if (options?.scheduled_for) {
    if (!settings.scheduled_orders_enabled) {
      throw new Error("This food seller does not accept scheduled orders.");
    }
    const scheduled = new Date(options.scheduled_for);
    if (!Number.isFinite(scheduled.getTime())) throw new Error("Choose a valid scheduled order time.");
    if (scheduled.getTime() < Date.now() + prepMinutes * 60_000) {
      throw new Error(`Choose a time at least ${prepMinutes} minutes from now.`);
    }
    if (!isWithinOpeningHours(scheduled, settings)) {
      throw new Error("Choose a scheduled time during this seller's opening hours.");
    }
    requestedFor = scheduled.toISOString();
  } else if (!isWithinOpeningHours(new Date(), settings)) {
    throw new Error("This food seller is outside opening hours. Choose a scheduled time if available.");
  }

  return {
    order_id: null as string | null,
    seller_id: settings.seller_id,
    fulfillment_method: delivery.delivery_type,
    requested_for: requestedFor,
    preparation_minutes: prepMinutes,
    delivery_fee: delivery.delivery_type === "pickup"
      ? Number(seller?.pickup_fee ?? 0)
      : Number(seller?.door_delivery_fee ?? 0),
  };
}

export async function saveFoodOrderDetails(
  supabaseAdmin: SupabaseClient,
  orderId: string,
  details: Awaited<ReturnType<typeof validateFoodCheckout>>,
  actualDeliveryFee: number,
) {
  if (!details) return;
  const { error } = await supabaseAdmin.from("food_order_details").insert({
    order_id: orderId,
    seller_id: details.seller_id,
    fulfillment_method: details.fulfillment_method,
    requested_for: details.requested_for,
    preparation_minutes: details.preparation_minutes,
    delivery_fee: actualDeliveryFee,
  });
  if (error) throw new Error(error.message);
}
