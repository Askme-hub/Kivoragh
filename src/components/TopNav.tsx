import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ShoppingCart,
  UserCircle2,
  Store,
  Shield,
  Search,
  HelpCircle,
  Package,
  Heart,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useShop } from "@/lib/store";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useIsSeller } from "@/hooks/use-seller";
import { UserAvatar } from "@/components/UserAvatar";
import { InboxBell } from "@/components/InboxBell";
import { MessageBell } from "@/components/MessageBell";
import { HeaderChips } from "@/components/AppDrawer";
import kivoraIcon from "@/assets/kivora-icon.png";

export function TopNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const count = useShop((s) => s.cartCount());
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin(user);
  const { data: isSeller } = useIsSeller(user);

  useEffect(() => setMounted(true), []);

  if (path === "/login") return null;

  const action =
    "relative inline-flex h-10 items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/80 bg-background/95 shadow-sm backdrop-blur-xl md:block">
      <div className="flex h-8 items-center justify-center gap-4 overflow-hidden bg-primary px-3 text-[10px] font-bold text-primary-foreground sm:gap-8 sm:text-[11px]">
        <span className="whitespace-nowrap">🚚 Free Shipping on orders over GH₵500</span>
        <span className="hidden h-4 border-l border-white/40 sm:block" />
        <span className="hidden whitespace-nowrap sm:inline">🏷️ Big Deals. Bigger Savings!</span>
        <span className="hidden h-4 border-l border-white/40 md:block" />
        <span className="hidden whitespace-nowrap md:inline">👑 Shop Smart. Live Better with Kivora</span>
      </div>
      <div className="h-1 bg-gradient-to-r from-primary via-amber-300 to-primary" />
      <div className="border-b border-border/60 bg-muted/35">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] font-medium text-muted-foreground lg:px-6">
          <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary" /> Shopping across Ghana</span>
          <div className="flex items-center gap-4">
            <Link to="/help" className="transition hover:text-primary">Help centre</Link>
            <Link to="/orders" className="transition hover:text-primary">Track an order</Link>
            {isSeller && <Link to="/seller" className="transition hover:text-primary">Seller centre</Link>}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:gap-6 lg:px-6">
        <Link to="/" aria-label="Kivora home" className="group flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15 transition group-hover:bg-primary/15">
            <img src={kivoraIcon} alt="" className="h-8 w-8 rounded-lg object-contain" />
          </span>
          <span className="text-[25px] font-black uppercase tracking-[-0.07em] text-foreground">
            Kivora<span className="ml-0.5 text-primary">★</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => router.navigate({ to: "/search", search: { q: "" } })}
          aria-label="Search products, brands and categories"
          className="group flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-muted/45 px-4 text-left transition hover:border-primary/50 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Search size={19} className="shrink-0 text-muted-foreground transition group-hover:text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">Search products, brands and categories</span>
          <span className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm transition group-hover:brightness-105">Search</span>
        </button>

        <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-0.5">
          {mounted && !user ? (
            <Link to="/login" className="mr-1 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-105">
              <UserCircle2 size={18} /> <span>Login / Sign up</span>
            </Link>
          ) : (
            <Link to="/account" className={action} aria-label="Account" title="Account">
              {user ? <UserAvatar user={user} size={22} /> : <UserCircle2 size={21} />}
              <span className="hidden xl:inline">Account</span>
              <ChevronDown size={13} className="hidden text-muted-foreground xl:block" />
            </Link>
          )}
          <Link to="/orders" className={action} aria-label="Orders" title="Orders"><Package size={20} /></Link>
          <Link to="/wishlist" className={action} aria-label="Wishlist" title="Wishlist"><Heart size={20} /></Link>
          <Link to="/help" className={action} aria-label="Help" title="Help"><HelpCircle size={20} /></Link>
          {isSeller && <Link to="/seller" className={action} aria-label="Seller hub" title="Seller hub"><Store size={20} /></Link>}
          {isAdmin && <Link to="/admin" className={action} aria-label="Admin" title="Admin"><Shield size={19} /></Link>}
          <MessageBell variant="desktop" />
          <InboxBell variant="desktop" />
          <Link to="/cart" className={`${action} ml-1 bg-primary/8 text-primary hover:bg-primary/15 hover:text-primary`} aria-label={`Cart${mounted && count > 0 ? `, ${count} items` : ""}`} title="Cart">
            <ShoppingCart size={21} />
            <span className="hidden xl:inline">Cart</span>
            {mounted && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </nav>
      </div>

      <div className="border-t border-border/60 bg-background/80">
        <div className="mx-auto max-w-7xl px-6"><HeaderChips desktop /></div>
      </div>
    </header>
  );
}
