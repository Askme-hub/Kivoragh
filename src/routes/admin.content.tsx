import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SITE_KEY, useSiteContent, type SiteContent } from "@/lib/site-content";

export const Route = createFileRoute("/admin/content")({
  component: AdminContent,
  head: () => ({ meta: [
    { title: "Site Content — Kivora Admin" },
    { name: "description", content: "Edit Kivora's phone numbers, WhatsApp, email and tagline." },
    { property: "og:title", content: "Site Content — Kivora Admin" },
    { property: "og:description", content: "Control contact details shown across Kivora." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const FIELDS: { key: keyof SiteContent; label: string; hint: string }[] = [
  { key: "phone_primary", label: "Main phone (Call to order)", hint: "Header, cart, homepage, footer" },
  { key: "phone_secondary", label: "Second phone", hint: "Footer, homepage, help page" },
  { key: "whatsapp", label: "WhatsApp support number", hint: "Help button and WhatsApp links" },
  { key: "email", label: "Support email", hint: "Footer and help page" },
  { key: "tagline", label: "Header tagline", hint: "Small text in the phone header" },
];

function AdminContent() {
  const current = useSiteContent();
  const qc = useQueryClient();
  const [form, setForm] = useState<SiteContent>(current);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(current), [current]);

  const save = async () => {
    if (!form.phone_primary.trim() || !form.whatsapp.trim()) return toast.error("Main phone and WhatsApp can't be empty.");
    setSaving(true);
    const { error } = await supabase.from("settings").upsert({ key: SITE_KEY, value: form, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved — the site now shows the new details");
    qc.invalidateQueries({ queryKey: ["site-content"] });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-black">Site Content</h1>
        <p className="text-sm text-muted-foreground">Change contact details shown to shoppers everywhere on Kivora.</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input id={f.key} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">Shown on: {f.hint}</p>
          </div>
        ))}
        <Button className="btn-hot w-full sm:w-auto" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
