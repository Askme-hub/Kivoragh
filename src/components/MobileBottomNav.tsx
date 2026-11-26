import { Link, useRouterState } from "@tanstack/react-router";
import { HomeSolid, GridSolid, CartSolid, UserSolid } from "@/components/icons/SolidIcons";
import { useEffect, useState } from "react";
import { useShop } from "@/lib/store";

const tabs = [
  { to: "/", label: "Home", icon: HomeSolid, exact: true },
  { to: "/categories", label: "Categories", icon: GridSolid },
  { to: "/cart", label: "Cart", icon: CartSolid, cart: true },
  { to: "/account", label: "Account", icon: UserSolid },
] as const;

/** Compact, thumb-friendly navigation for phones. */
export function MobileBottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const count = useShop((s) => s.cartCount());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (path === "/login" || path === "/checkout") return null;

  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-bottom-nav backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const active = "exact" in tab ? path === tab.to : path === tab.to || path.startsWith(tab.to + "/");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 px-2 pt-1 text-[10px] font-semibold transition-colors active:bg-muted/70 ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {active && <span className="absolute inset-x-7 top-0 h-[3px] rounded-b-full bg-primary" />}
              <span className={`relative flex h-8 w-10 items-center justify-center rounded-2xl transition-colors ${active ? "bg-primary/10" : ""}`}>
                <Icon size={22} className={active ? "" : "opacity-80"} />
                {"cart" in tab && mounted && count > 0 && (
                  <span className="absolute right-0 top-0 flex h-[17px] min-w-[17px] -translate-y-0.5 translate-x-1 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
