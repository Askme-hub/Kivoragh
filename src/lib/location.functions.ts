import { createServerFn } from "@tanstack/react-start";
import { matchGhanaRegion } from "./ghana-region";

export type DetectedAddress = { region: string | null; city: string; address: string; inGhana: boolean };

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => {
    const lat = Number(d.lat), lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Invalid location");
    return { lat, lng };
  })
  .handler(async ({ data }): Promise<DetectedAddress | { error: string }> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${data.lat}&lon=${data.lng}`;
      const res = await fetch(url, { headers: { "User-Agent": "Kivora/1.0 (https://kivoragh.shop)", "Accept-Language": "en" } });
      if (!res.ok) return { error: "Could not look up your location" };
      const j: any = await res.json();
      const a = j.address ?? {};
      const city = a.suburb || a.neighbourhood || a.quarter || a.town || a.city || a.village || a.city_district || a.county || "";
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      const near = a.amenity || a.shop || a.building || "";
      const town = a.city || a.town || "";
      const address = [street, near && `near ${near}`, town && town !== city ? town : ""].filter(Boolean).join(", ");
      return { region: matchGhanaRegion(a.state), city, address, inGhana: a.country_code === "gh" };
    } catch (e) {
      console.error("reverseGeocode", e);
      return { error: "Location service unavailable" };
    }
  });
