import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContent = {
  phone_primary: string;
  phone_secondary: string;
  whatsapp: string;
  email: string;
  tagline: string;
};

export const SITE_DEFAULTS: SiteContent = {
  phone_primary: "025 757 3471",
  phone_secondary: "055 247 4242",
  whatsapp: "025 757 3471",
  email: "support@kivoragh.shop",
  tagline: "Pay on delivery · 16 regions",
};

export const SITE_KEY = "site.content";

/** Digits for tel: links, e.g. "0257573471". */
export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
/** International digits for wa.me, e.g. "233257573471". */
export function waNumber(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return "233" + d.slice(1);
  return d;
}

export function useSiteContent(): SiteContent {
  const { data } = useQuery({
    queryKey: ["site-content"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", SITE_KEY).maybeSingle();
      return { ...SITE_DEFAULTS, ...((data?.value as Partial<SiteContent>) ?? {}) };
    },
  });
  return data ?? SITE_DEFAULTS;
}
