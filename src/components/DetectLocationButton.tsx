import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { reverseGeocode, type DetectedAddress } from "@/lib/location.functions";

export function DetectLocationButton({ onDetected }: { onDetected: (a: DetectedAddress) => void }) {
  const lookup = useServerFn(reverseGeocode);
  const [busy, setBusy] = useState(false);
  const detect = () => {
    if (!("geolocation" in navigator)) return toast.error("Your browser can't share location. Please type your address.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await lookup({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          if ("error" in r) return toast.error(r.error);
          if (!r.inGhana) return toast.error("You seem to be outside Ghana. Please type your delivery address.");
          onDetected(r);
          toast.success("Location found — please check and add a landmark");
        } catch { toast.error("Could not detect location"); }
        finally { setBusy(false); }
      },
      (err) => {
        setBusy(false);
        toast.error(err.code === 1 ? "Location permission denied. Allow it in your browser or type your address." : "Couldn't get your location. Try again outdoors or type it.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  return (
    <button type="button" onClick={detect} disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/10 disabled:opacity-60">
      {busy ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
      {busy ? "Finding your location…" : "Use my current location"}
    </button>
  );
}
