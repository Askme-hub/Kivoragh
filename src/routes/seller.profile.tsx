import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSellerProfile } from "@/hooks/use-seller";
import { SellerVerification } from "@/components/SellerVerification";
import { ShopCardStudio } from "@/components/ShopCardStudio";
import { canvasToBlob, renderShopCover, renderShopLogo } from "@/lib/shop-card";

export const Route = createFileRoute("/seller/profile")({ component: SellerProfilePage });

const GH_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern",
  "Volta", "Northern", "Upper East", "Upper West", "Bono",
  "Bono East", "Ahafo", "Western North", "Oti", "Savannah", "North East",
];

function SellerProfilePage() {
  const { user } = useAuth();
  const { data: profile, refetch } = useSellerProfile(user);
  const [shop, setShop] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [location, setLocation] = useState("");
  const [storeRegion, setStoreRegion] = useState("Greater Accra");
  const [allRegions, setAllRegions] = useState(false);
  const [bizCat, setBizCat] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [doorFee, setDoorFee] = useState("25");
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupStation, setPickupStation] = useState("");
  const [pickupRegion, setPickupRegion] = useState("Greater Accra");
  const [pickupFee, setPickupFee] = useState("10");
  const [busy, setBusy] = useState(false);
  const [foodSeller, setFoodSeller] = useState(false);
  const [foodAccepting, setFoodAccepting] = useState(false);
  const [foodOpensAt, setFoodOpensAt] = useState("08:00");
  const [foodClosesAt, setFoodClosesAt] = useState("21:00");
  const [foodDays, setFoodDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  const [foodPrepMinutes, setFoodPrepMinutes] = useState("30");
  const [foodScheduled, setFoodScheduled] = useState(true);

  useEffect(() => {
    if (profile) {
      setShop(profile.shop_name ?? "");
      setBio(profile.bio ?? "");
      setPhone(profile.phone ?? "");
      setWhatsapp((profile as any).whatsapp_number ?? "");
      setLocation((profile as any).location ?? "");
      setStoreRegion((profile as any).store_region ?? "Greater Accra");
      setAllRegions(Boolean((profile as any).deliver_all_regions));
      setBizCat((profile as any).business_category ?? "");
      setLogoUrl((profile as any).logo_url ?? "");
      setBannerUrl((profile as any).banner_url ?? "");
      setDoorFee(String((profile as any).door_delivery_fee ?? 25));
      setPickupEnabled(Boolean((profile as any).pickup_enabled));
      setPickupStation((profile as any).pickup_station ?? "");
      setPickupRegion((profile as any).pickup_region ?? "Greater Accra");
      setPickupFee(String((profile as any).pickup_fee ?? 10));
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (supabase as any).from("food_seller_settings").select("*").eq("seller_id", user.id).maybeSingle().then(({ data, error }: any) => {
      if (!active || error || !data) return;
      setFoodSeller(Boolean(data.is_food_seller));
      setFoodAccepting(Boolean(data.accepting_orders));
      setFoodOpensAt(String(data.opens_at ?? "08:00").slice(0, 5));
      setFoodClosesAt(String(data.closes_at ?? "21:00").slice(0, 5));
      setFoodDays(Array.isArray(data.days_open) ? data.days_open : []);
      setFoodPrepMinutes(String(data.default_preparation_minutes ?? 30));
      setFoodScheduled(Boolean(data.scheduled_orders_enabled));
    });
    return () => { active = false; };
  }, [user?.id]);

  if (!user) return <p className="p-6 text-sm">Please log in.</p>;
  if (!profile) return <p className="p-6 text-sm">No shop yet — submit an application from the Dashboard.</p>;

  const upload = async (file: File, kind: "logo" | "banner") => {
    setUploading(kind);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/store/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    setUploading(null);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(data.publicUrl);
    else setBannerUrl(data.publicUrl);
    toast.success(`${kind === "logo" ? "Logo" : "Cover"} uploaded — remember to save`);
  };


  const autoDesign = async (kind: "logo" | "banner") => {
    if (!shop.trim()) return toast.error("Enter your shop name first");
    const details = { shop_name: shop.trim(), slug: "", location, business_category: bizCat };
    const canvas = kind === "logo" ? await renderShopLogo(details) : await renderShopCover(details);
    const blob = await canvasToBlob(canvas);
    await upload(new File([blob], `${kind}.png`, { type: "image/png" }), kind);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pickupEnabled && !pickupStation.trim()) {
      return toast.error("Enter a pickup station name or turn pickup off");
    }
    setBusy(true);
    const { error } = await supabase
      .from("seller_profiles")
      .update({
        shop_name: shop,
        bio: bio || null,
        phone: phone || null,
        whatsapp_number: whatsapp || null,
        location: location || null,
        store_region: storeRegion,
        deliver_all_regions: allRegions,
        business_category: bizCat || null,
        logo_url: logoUrl || null,
        banner_url: bannerUrl || null,
        door_delivery_fee: Math.max(0, Number(doorFee) || 0),

        pickup_enabled: pickupEnabled,
        pickup_station: pickupEnabled ? pickupStation.trim() : null,
        pickup_region: pickupEnabled ? pickupRegion : null,
        pickup_fee: Math.max(0, Number(pickupFee) || 0),
      } as any)
      .eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    const { error: foodError } = await (supabase as any).from("food_seller_settings").upsert({
      seller_id: user.id,
      is_food_seller: foodSeller,
      accepting_orders: foodSeller && foodAccepting,
      opens_at: foodOpensAt,
      closes_at: foodClosesAt,
      days_open: foodDays,
      default_preparation_minutes: Math.max(0, Math.min(1440, Number(foodPrepMinutes) || 0)),
      scheduled_orders_enabled: foodScheduled,
    }, { onConflict: "seller_id" });
    if (foodError) return toast.error(`Shop saved, but food settings could not be saved: ${foodError.message}`);
    toast.success("Shop updated");
    refetch();
  };

  const inputCls = "w-full border-2 border-border rounded-md px-4 py-3 bg-background text-foreground outline-none focus:border-primary";

  return (
    <form onSubmit={save} className="p-4 max-w-2xl mx-auto space-y-3 md:p-6">
      <h2 className="text-xl font-bold text-foreground">Shop Details</h2>
      <p className="text-xs text-muted-foreground">Status: <span className="font-bold uppercase">{profile.status}</span></p>

      <SellerVerification
        userId={user.id}
        status={profile.status}
        verificationStatus={(profile as any).verification_status ?? "not_verified"}
        onChanged={() => refetch()}
      />

      {(profile as any).slug && (
        <div className="rounded-xl bg-primary-soft px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Your public store link</p>
          <a
            href={`/shop/${(profile as any).slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm font-bold text-primary"
          >
            /shop/{(profile as any).slug}
          </a>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {profile.status === "approved"
              ? "Live — share it with your customers."
              : "Visible to shoppers once your shop is approved."}
          </p>
        </div>
      )}

      {(profile as any).slug && (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-bold text-foreground">Shop card & flyer (with QR code)</summary>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Download a free card to print or share on WhatsApp. Customers scan the QR code to open your shop.</p>
          <ShopCardStudio
            shop={{
              shop_name: profile.shop_name,
              slug: (profile as any).slug,
              logo_url: (profile as any).logo_url,
              location: (profile as any).location,
              whatsapp_number: (profile as any).whatsapp_number,
              phone: profile.phone,
              business_category: (profile as any).business_category,
              verified: (profile as any).verification_status === "verified",
            }}
          />
        </details>
      )}

      <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop name" className={inputCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (private)" className={inputCls} />
      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp number (shown on your store)" className={inputCls} />
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location e.g. Adum, Kumasi" className={inputCls} />
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Store region (Pay on Delivery is only offered to buyers in this region)</label>
        <select value={storeRegion} onChange={(e) => setStoreRegion(e.target.value)} className={inputCls}>
          {GH_REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="mt-2 flex items-start gap-2 rounded-md border-2 border-border p-3 text-sm text-foreground">
          <input type="checkbox" checked={allRegions} onChange={(e) => setAllRegions(e.target.checked)} className="mt-1 accent-primary" />
          <span>
            <span className="font-semibold">Deliver to all regions</span>
            <span className="block text-xs text-muted-foreground">Let buyers anywhere in Ghana order your products with Pay on Delivery. Leave off to accept Pay on Delivery only in your store region.</span>
          </span>
        </label>
      </div>
      <input value={bizCat} onChange={(e) => setBizCat(e.target.value)} placeholder="Business category e.g. Electronics" className={inputCls} />
      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="About your shop" className={inputCls} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Shop logo</label>
          {logoUrl && <img src={logoUrl} alt="Shop logo" className="mb-2 h-16 w-16 rounded-xl object-cover" />}
          <input
            type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "logo"); }}
            className="w-full text-xs text-muted-foreground"
          />
          <button type="button" disabled={uploading !== null} onClick={() => void autoDesign("logo")} className="mt-2 w-full rounded-full border border-primary px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-60">
            {uploading === "logo" ? "Working…" : "Design a logo for me"}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cover image</label>
          {bannerUrl && <img src={bannerUrl} alt="Store cover" className="mb-2 h-16 w-full rounded-xl object-cover" />}
          <input
            type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "banner"); }}
            className="w-full text-xs text-muted-foreground"
          />
          <button type="button" disabled={uploading !== null} onClick={() => void autoDesign("banner")} className="mt-2 w-full rounded-full border border-primary px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-60">
            {uploading === "banner" ? "Working…" : "Design a cover for me"}
          </button>
        </div>
      </div>
      {uploading && <p className="text-xs text-muted-foreground">Uploading {uploading}…</p>}


      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h3 className="font-bold text-foreground">Food &amp; Groceries</h3>
          <p className="mt-1 text-xs text-muted-foreground">Enable this if your business sells prepared meals, groceries, baked goods, snacks or drinks. Food ordering is separate from your ordinary product listings.</p>
        </div>
        <label className="flex items-start gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={foodSeller} onChange={(e) => { setFoodSeller(e.target.checked); if (!e.target.checked) setFoodAccepting(false); }} className="mt-1" />
          <span>My shop sells food or groceries</span>
        </label>
        {foodSeller && <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={foodAccepting} onChange={(e) => setFoodAccepting(e.target.checked)} />
            Accept food orders now
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Opening time</label><input type="time" value={foodOpensAt} onChange={(e) => setFoodOpensAt(e.target.value)} className={inputCls} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Closing time</label><input type="time" value={foodClosesAt} onChange={(e) => setFoodClosesAt(e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className="mb-2 block text-xs font-semibold text-muted-foreground">Days open</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((day) => <label key={day} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" checked={foodDays.includes(day)} onChange={(e) => setFoodDays((current) => e.target.checked ? [...current, day] : current.filter((d) => d !== day))} />{day}</label>)}</div>
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Default preparation time (minutes)</label><input type="number" min="0" max="1440" step="5" value={foodPrepMinutes} onChange={(e) => setFoodPrepMinutes(e.target.value)} className={inputCls} /></div>
          <label className="flex items-start gap-2 text-sm text-foreground"><input type="checkbox" checked={foodScheduled} onChange={(e) => setFoodScheduled(e.target.checked)} className="mt-1" /><span><span className="font-semibold">Allow scheduled food orders</span><span className="block text-xs text-muted-foreground">Let customers choose a later collection or delivery time. Scheduling controls will be added in a later phase.</span></span></label>
          <p className="text-[11px] text-muted-foreground">Timezone: Ghana (Africa/Accra). Delivery charges continue to use your existing seller delivery settings; pickup uses your existing pickup settings.</p>
        </div>}
      </div>

      <div className="pt-2 border-t border-border space-y-3">

        <h3 className="font-bold text-foreground">Delivery Settings</h3>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Door delivery fee (GH₵)</label>
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={doorFee} onChange={(e) => setDoorFee(e.target.value)}
            placeholder="25" className={inputCls}
          />
          <p className="text-[11px] text-muted-foreground mt-1">Charged to buyers who choose door delivery from your store. If Kivora's regional minimum is higher, the regional price is used.</p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" checked={pickupEnabled} onChange={(e) => setPickupEnabled(e.target.checked)} />
          Offer a pickup station
        </label>

        {pickupEnabled && (
          <div className="space-y-3 pl-1">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Pickup station name / address</label>
              <input value={pickupStation} onChange={(e) => setPickupStation(e.target.value)} placeholder="e.g. Kivora Store, Adum" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Region</label>
              <select value={pickupRegion} onChange={(e) => setPickupRegion(e.target.value)} className={inputCls}>
                {GH_REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Pickup fee (GH₵)</label>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={pickupFee} onChange={(e) => setPickupFee(e.target.value)}
                placeholder="10" className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      <button disabled={busy} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-md disabled:opacity-60">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
