import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Shield, Store, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
  head: () => ({ meta: [
    { title: "Users & Roles — Kivora Admin" },
    { name: "description", content: "See everyone who signed up on Kivora and manage their roles." },
    { property: "og:title", content: "Users & Roles — Kivora Admin" },
    { property: "og:description", content: "Manage Kivora users and admin access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Role = "admin" | "seller" | "user";
type Row = { id: string; email: string | null; phone: string | null; display_name: string | null; created_at: string; last_seen_at: string | null; roles: Role[] };

const ROLE_STYLE: Record<Role, string> = {
  admin: "bg-destructive/10 text-destructive",
  seller: "bg-primary/10 text-primary",
  user: "bg-muted text-muted-foreground",
};

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const { data: rows = [], isPending } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<Row[]> => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id,email,phone,display_name,created_at,last_seen_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (p.error) throw p.error;
      const map = new Map<string, Role[]>();
      (r.data ?? []).forEach((x) => map.set(x.user_id, [...(map.get(x.user_id) ?? []), x.role as Role]));
      return (p.data ?? []).map((u) => ({ ...u, roles: map.get(u.id) ?? [] }));
    },
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (filter === "admin" && !u.roles.includes("admin")) return false;
      if (filter === "seller" && !u.roles.includes("seller")) return false;
      if (filter === "user" && (u.roles.includes("admin") || u.roles.includes("seller"))) return false;
      if (!s) return true;
      return [u.email, u.phone, u.display_name].some((v) => v?.toLowerCase().includes(s));
    });
  }, [rows, q, filter]);

  const counts = {
    all: rows.length,
    admin: rows.filter((u) => u.roles.includes("admin")).length,
    seller: rows.filter((u) => u.roles.includes("seller")).length,
    user: rows.filter((u) => !u.roles.includes("admin") && !u.roles.includes("seller")).length,
  };

  const toggleAdmin = async (u: Row) => {
    const isAdmin = u.roles.includes("admin");
    if (isAdmin && u.id === me) return toast.error("You can't remove your own admin access.");
    const name = u.display_name || u.email || u.phone || "this user";
    if (!confirm(isAdmin ? `Remove admin access from ${name}?` : `Make ${name} an admin? They will have full control of Kivora.`)) return;
    setBusy(u.id);
    const { error } = isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", u.id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(isAdmin ? "Admin access removed" : "User is now an admin");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">Everyone who signed up. Sellers get their role when you approve their shop.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "admin", "seller", "user"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
            {f === "user" ? "Buyers" : f === "all" ? "All" : f + "s"} · {counts[f]}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className="pl-9" />
      </div>
      {isPending ? <p className="text-sm text-muted-foreground">Loading users…</p> : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No users match.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const shown: Role[] = u.roles.length ? u.roles : ["user"];
            return (
              <li key={u.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    {isAdmin ? <Shield size={18} /> : u.roles.includes("seller") ? <Store size={18} /> : <UserIcon size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{u.display_name || "No name"}{u.id === me && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}{u.last_seen_at && ` · Last seen ${new Date(u.last_seen_at).toLocaleDateString()}`}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {shown.map((r) => <span key={r} className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${ROLE_STYLE[r]}`}>{r === "user" ? "buyer" : r}</span>)}
                  <Button size="sm" variant={isAdmin ? "outline" : "default"} disabled={busy === u.id || (isAdmin && u.id === me)} onClick={() => toggleAdmin(u)}>
                    {isAdmin ? "Remove admin" : "Make admin"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
