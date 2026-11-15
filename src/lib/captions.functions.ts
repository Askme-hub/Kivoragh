import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  listing: z.string().trim().min(3).max(1500),
  audience: z.string().trim().min(2).max(300),
  tone: z.string().trim().max(40).default("Friendly"),
});

export const generateCaptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "You write short, share-ready promotional captions for sellers on Kivora, a Ghanaian online marketplace. Write for Ghanaian buyers: prices in GH₵, friendly local flavour (light Ghanaian English/Pidgin only if the tone fits), mention Pay on Delivery and delivery across Ghana when relevant. Never invent prices, discounts or specs not given. Return ONLY JSON: {\"captions\":[{\"platform\":\"WhatsApp Status\"|\"Instagram\"|\"TikTok\"|\"Facebook\",\"text\":string}]} with 4 captions, one per platform, each with fitting emojis and 2-5 hashtags for Instagram/TikTok.",
        input: `Product listing:\n${data.listing}\n\nTarget audience: ${data.audience}\nTone: ${data.tone}`,
      });
      const r: any = res;
      const text: string =
        r.output_text ??
        (r.output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("");
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      const captions = z.array(z.object({ platform: z.string(), text: z.string() })).parse(json.captions);
      return { captions, error: null as string | null };
    } catch (e) {
      console.error("caption error", e);
      if (e instanceof GatewayError && e.httpStatus === 429) return { captions: [], error: "Too many requests — please wait a minute and try again." };
      if (e instanceof GatewayError && e.httpStatus === 402) return { captions: [], error: "AI credits are used up. Please contact Kivora support." };
      return { captions: [], error: "Couldn't create captions right now. Please try again." };
    }
  });
