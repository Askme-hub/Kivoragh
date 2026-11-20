import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  Heart,
  UserCircle2,
  Package,
  Store,
  Shield,
  Menu,
  LogOut,
  LogIn,
  Wallet,
  Mail,
  Search,
  HelpCircle,
  Tag,
  MessageCircle,

  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useIsSeller } from "@/hooks/use-seller";
import { useCategories } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import kivoraIcon from "@/assets/kivora-icon.png";
import { UserAvatar } from "@/components/UserAvatar";
import { InstallAppButton } from "@/components/InstallAppButton";
import { MessageBell } from "@/components/MessageBell";
import { useUnreadChatCount } from "@/lib/messages";

const accountItems = [
  { to: "/orders" as const, label: "Orders", icon: Package },
  { to: "/inbox" as const, label: "Inbox", icon: Mail },
  { to: "/messages" as const, label: "Messages", icon: MessageCircle },
  { to: "/wishlist" as const, label: "Wishlist", icon: Heart },
  { to: "/cart" as const, label: "Cart", icon: ShoppingCart },
];

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-3 mb-1 flex items-center justify-between border-t border-border px-5 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  );
}


export function AppDrawer() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin(user);
  const { data: categories = [] } = useCategories();
  const { data: isSeller } = useIsSeller(user);
  const { data: chatUnread = 0 } = useUnreadChatCount(user?.id);

  // close on route change
  useEffect(() => {
    setOpen(false);
  }, [path]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    setOpen(false);
    router.navigate({ to: "/login" });
  };

  const NavLink = ({
    to,
    label,
    icon: Icon,
    active,
    badge,
  }: {
    to: string;
    label: string;
    icon: typeof Home;
    active: boolean;
    badge?: number;
  }) => (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/80 hover:bg-muted"
      }`}
    >
      <span className="relative">
        <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
        {!!badge && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="flex h-10 items-center gap-1 rounded-full bg-background pl-2.5 pr-3 text-primary shadow-elevated ring-2 ring-primary-foreground/60 transition active:scale-95"
        >
          <Menu size={22} strokeWidth={2.75} />
          <span className="text-[11px] font-black uppercase">Menu</span>
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[82%] max-w-xs p-0 flex flex-col bg-background"
      >
        {/* Brand header */}
        <div className="brand-band bg-primary p-5 flex items-center gap-3">
          {user ? (
            <UserAvatar user={user} size={44} className="ring-2 ring-primary-foreground/50" />
          ) : (
            <img src={kivoraIcon} alt="Kivora" className="w-11 h-11 rounded-xl" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold leading-tight">Kivora</p>
            <p className="text-xs opacity-90 truncate">
              {user ? user.email : "Welcome, guest"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="px-2 space-y-0.5">
            <NavLink to="/" label="Home" icon={Home} active={path === "/"} />
            <NavLink to="/categories" label="Shop Products" icon={LayoutGrid} active={path.startsWith("/categories")} />
            <NavLink to="/account" label="Account & Settings" icon={UserCircle2} active={path.startsWith("/account")} />
          </div>
          <SectionLabel>My Orders & Lists</SectionLabel>
          <div className="px-2 space-y-0.5">
            {accountItems.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} label={label} icon={icon} active={path.startsWith(to)} badge={to === "/messages" ? chatUnread : undefined} />
            ))}
          </div>

          <SectionLabel
            action={
              <Link to="/categories" className="text-xs font-semibold text-primary">
                See All
              </Link>
            }
          >
            Our Categories
          </SectionLabel>
          <div className="px-2 space-y-0.5">
            {categories.length === 0 ? (
              <NavLink to="/categories" label="All Categories" icon={LayoutGrid} active={path.startsWith("/categories")} />
            ) : (
              categories.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  to="/categories"
                  search={{ c: c.name }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted transition"
                >
                  <Tag size={18} className="text-muted-foreground" />
                  {c.name}
                </Link>
              ))
            )}
          </div>

          <div className="px-4 pt-3">
            <InstallAppButton />
          </div>

          <SectionLabel>Our Services</SectionLabel>
          <div className="px-2 space-y-0.5">
            <NavLink to="/seller" label="Sell on Kivora" icon={Store} active={path.startsWith("/seller")} />
            <NavLink to="/inbox" label="Help Center" icon={HelpCircle} active={false} />
          </div>

          {isSeller && (
            <>
              <SectionLabel>Seller Dashboard</SectionLabel>
              <div className="px-2 space-y-0.5">
                <NavLink to="/seller" label="Overview" icon={Store} active={path === "/seller"} />
                <NavLink to="/seller/products" label="My Products" icon={Package} active={path.startsWith("/seller/products")} />
                <NavLink to="/seller/orders" label="Orders" icon={ShoppingCart} active={path.startsWith("/seller/orders")} />
                <NavLink to="/seller/messages" label="Messages" icon={MessageCircle} active={path.startsWith("/seller/messages")} badge={chatUnread} />
                <NavLink to="/seller/wallet" label="Wallet" icon={Wallet} active={path.startsWith("/seller/wallet")} />
                <NavLink to="/seller/subscription" label="Plans" icon={Tag} active={path.startsWith("/seller/subscription")} />
                <NavLink to="/seller/profile" label="Store Settings" icon={UserCircle2} active={path.startsWith("/seller/profile")} />
              </div>
            </>
          )}

          {isAdmin && (
            <>
              <SectionLabel>Admin</SectionLabel>
              <div className="px-2 space-y-0.5">
                <NavLink to="/admin" label="Admin Panel" icon={Shield} active={path.startsWith("/admin")} />
              </div>
            </>
          )}
        </nav>


        {/* Footer */}
        <div className="border-t border-border p-3 space-y-3">
          <div>
            <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Appearance
            </p>
            <ThemeToggle />
          </div>
          {user ? (
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 transition"
            >
              <LogOut size={20} /> Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="flex w-full items-center gap-3 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground"
            >
              <LogIn size={20} /> Log in / Sign up
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Minimal mobile shopping header: search first, categories directly below. */
export function MobileTopBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { user } = useAuth();

  if (path === "/login" || path === "/search") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur md:hidden">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <button
          type="button"
          onClick={() => router.navigate({ to: "/search", search: { q: "" } })}
          aria-label="Search products on Kivora"
          className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border-2 border-primary/25 bg-card px-3.5 text-left shadow-[0_5px_18px_-12px_hsl(var(--primary)/0.45)] transition hover:border-primary/50 active:scale-[0.99]"
        >
          <Search size={22} strokeWidth={2.3} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-muted-foreground">
            Search products, brands and categories
          </span>
          <span className="rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground">
            Search
          </span>
        </button>
        {user && (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5">
            <MessageBell variant="mobile" />
          </div>
        )}
      </div>
      <HeaderChips />
    </header>
  );
}

/** Scrollable hot-deal chips under the search bar (shared by mobile + desktop). */
export function HeaderChips({ desktop = false }: { desktop?: boolean }) {
  const { data: categories = [] } = useCategories();
  const base = desktop
    ? "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition"
    : "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold transition active:scale-95";
  const soft = desktop ? "bg-muted text-foreground hover:bg-primary-soft hover:text-primary" : "border border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary";
  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className={`flex gap-2 ${desktop ? "py-2.5" : "px-3 pb-2.5"}`}>
{desktop && (
          <a href="/#flash-sales" className={`${base} bg-flash text-flash-foreground`}>
            <Zap size={13} fill="currentColor" /> Flash Sale
          </a>
        )}
        <Link to="/categories" className={`${base} bg-primary text-primary-foreground`}>
          <LayoutGrid size={13} /> All
        </Link>
        {categories.slice(0, 12).map((c) => (
          <Link key={c.id} to="/categories" search={{ c: c.name }} className={`${base} ${soft}`}>
            {c.image_url && <img src={c.image_url} alt="" className="h-4 w-4 rounded-full object-cover" />}
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
