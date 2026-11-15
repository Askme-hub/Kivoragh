import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Choose a new password — Kivora Ghana" },
      { name: "description", content: "Set a new password for your Kivora account." },
      { property: "og:title", content: "Choose a new Kivora password" },
      { property: "og:description", content: "Finish resetting your Kivora password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("Link expired. Request a new code.");
    await supabase.auth.signOut();
    toast.success("Password changed. Please log in.");
    router.navigate({ to: "/login" });
  };
  return (
    <div className="min-h-screen px-6 pt-16 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input type="password" required minLength={8} autoComplete="new-password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border-2 border-border bg-background text-foreground focus:border-primary rounded-md px-4 py-3.5 outline-none" />
        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold py-4 rounded-md tracking-widest disabled:opacity-60">{loading ? "..." : "SAVE PASSWORD"}</button>
      </form>
    </div>
  );
}
