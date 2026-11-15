import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_CAMPAIGNS, POPUP_SETTINGS_KEY, type PopupCampaign } from "./popup-campaigns";

/** Public read of active pop-up campaigns only (settings table is admin-only). */
export const getPopupCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", POPUP_SETTINGS_KEY).maybeSingle();
  const list = Array.isArray(data?.value) ? (data!.value as unknown as PopupCampaign[]) : DEFAULT_CAMPAIGNS;
  return list.filter((c) => c.active);
});
