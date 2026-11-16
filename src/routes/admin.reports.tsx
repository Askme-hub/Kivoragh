import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
  head: () => ({ meta: [{ title: "Chat Reports — Kivora Admin" }, { name: "robots", content: "noindex" }] }),
});

const FILTERS = [
  { k: "open", label: "Pending" },
  { k: "actioned", label: "Actioned" },
  { k: "dismissed", label: "Dismissed" },
  { k: "all", label: "All" },
] as const;

type Person = { id: string; display_name: string | null; email: string | null; phone: string | null };

function who(p?: Person) {
  if (!p) return "Unknown user";
  return p.display_name || p.email || p.phone || p.id.slice(0, 8);
}

function AdminReports() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["k"]>("open");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-chat-reports", filter],
    queryFn: async () => {
      let q = supabase.from("chat_reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data: reports, error } = await q;
      if (error) throw error;
      const rows = reports ?? [];
      const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id]))];
      const msgIds = rows.map((r) => r.message_id).filter(Boolean) as string[];
      const [{ data: people }, { data: msgs }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, display_name, email, phone").in("id", ids) : Promise.resolve({ data: [] as Person[] }),
        msgIds.length ? supabase.from("messages").select("id, body").in("id", msgIds) : Promise.resolve({ data: [] as { id: string; body: string }[] }),
      ]);
      const pMap = new Map((people ?? []).map((p: any) => [p.id, p as Person]));
      const mMap = new Map((msgs ?? []).map((m: any) => [m.id, m.body as string]));
      return rows.map((r) => ({ ...r, reporter: pMap.get(r.reporter_id), reported: pMap.get(r.reported_user_id), message: r.message_id ? mMap.get(r.message_id) : undefined }));
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("chat_reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "open" ? "Reopened" : `Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-chat-reports"] });
    qc.invalidateQueries({ queryKey: ["admin-nav-counts"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><ShieldAlert className="text-primary" size={22} /> Chat reports</h1>
        <p className="text-sm text-muted-foreground">Messages buyers and sellers flagged as suspicious. Review and act quickly to keep Kivora safe.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap border", filter === f.k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No reports here. 🎉</div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive"><Flag size={12} /> {r.reason}</span>
                <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("en-GH")}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-muted/50 p-2"><p className="text-muted-foreground">Reported by</p><p className="font-semibold truncate">{who(r.reporter)}</p>{r.reporter?.phone && <p className="text-muted-foreground">{r.reporter.phone}</p>}</div>
                <div className="rounded-xl bg-destructive/5 p-2"><p className="text-muted-foreground">Reported user</p><p className="font-semibold truncate">{who(r.reported)}</p>{r.reported?.phone && <p className="text-muted-foreground">{r.reported.phone}</p>}</div>
              </div>
              {r.message && <blockquote className="border-l-4 border-destructive/60 bg-muted/40 rounded-r-lg px-3 py-2 text-sm italic break-words">“{r.message.replace(/\[\[(product|order):[^\]]*\]\]/g, "").trim() || "(attachment)"}”</blockquote>}
              {r.details && <p className="text-sm"><span className="font-semibold">Details: </span>{r.details}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {r.status === "open" ? (
                  <>
                    <button onClick={() => setStatus(r.id, "actioned")} className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">Mark actioned</button>
                    <button onClick={() => setStatus(r.id, "dismissed")} className="rounded-full border border-border px-4 py-1.5 text-xs font-bold">Dismiss</button>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold capitalize">{r.status}</span>
                    <button onClick={() => setStatus(r.id, "open")} className="text-xs font-bold text-primary">Reopen</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
