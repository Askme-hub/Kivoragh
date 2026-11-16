import { Product, formatGHC, useShop } from "@/lib/store";
import { Heart, Star, Minus, Plus, Flame, ShoppingCart, Truck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useProductRatingsMap } from "@/lib/reviews";

function PriceTag({ value, className = "" }: { value: number; className?: string }) {
  const [whole, dec] = formatGHC(value).replace(/GH₵\s?/, "").split(".");
  return (
    <span className={`inline-flex items-baseline font-extrabold leading-none tracking-tight ${className}`}>
      <span className="mr-0.5 text-[11px] font-bold">GH₵</span>
      <span className="text-[19px]">{whole}</span>
      {dec ? <span className="text-[11px] font-bold">.{dec}</span> : null}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const addToCart = useShop((s) => s.addToCart);
  const updateQty = useShop((s) => s.updateQty);
  const toggleWishlist = useShop((s) => s.toggleWishlist);
  const cartItem = useShop((s) => s.cart.find((c) => c.product.id === product.id));
  const qty = cartItem?.qty ?? 0;
  const wished = useShop((s) => s.wishlist.some((w) => w.id === product.id));

  const oldPrice =
    product.oldPrice ??
    (product.discount ? product.price + (product.price * product.discount) / 100 : null);
  const discount =
    product.discount ?? (oldPrice && oldPrice > product.price ? Math.round(((oldPrice - product.price) / oldPrice) * 100) : 0);

  const { data: ratings } = useProductRatingsMap();
  const rating = ratings?.[product.id];
  const stock = product.stock ?? 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 5;
  const atMax = qty >= stock;
  const stockPct = lowStock ? Math.max(12, (stock / 5) * 100) : 0;

  const add = () => {
    const ok = addToCart(product);
    if (ok !== false) toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-border/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-elevated">
      <div className="relative">
        <Link to="/products/$id" params={{ id: product.id }} className="block aspect-square overflow-hidden bg-muted/40">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-contain p-1.5 transition-transform duration-500 group-hover:scale-110 ${outOfStock ? "opacity-40 grayscale" : ""}`}
          />
        </Link>

        {discount > 0 && (
          <span className="absolute left-0 top-2 rounded-r-full bg-flash py-1 pl-2 pr-2.5 text-[12px] font-black text-flash-foreground shadow-md">
            -{discount}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-foreground/80 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-background">
            Sold out
          </span>
        )}

        <button
          onClick={() => {
            toggleWishlist(product);
            toast.success(wished ? "Removed from wishlist" : "Added to wishlist");
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card/95 shadow-sm backdrop-blur transition active:scale-90 ${
            wished ? "text-flash" : "text-muted-foreground hover:text-flash"
          }`}
        >
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </button>

        {lowStock && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-flash/95 px-2 py-0.5 text-[10px] font-bold text-flash-foreground">
            <Flame size={11} fill="currentColor" /> Almost gone
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <Link to="/products/$id" params={{ id: product.id }} className="line-clamp-2 min-h-[2.5rem] break-words text-[13px] leading-5 text-foreground hover:text-primary">
          {product.name}
        </Link>

        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-0.5 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success-ink">
            <Truck size={10} /> Pay on delivery
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-1 pt-1">
          <div className="min-w-0">
            <PriceTag value={product.price} className={discount > 0 ? "text-flash" : "text-foreground"} />
            <div className="flex items-center gap-1.5 text-[11px]">
              {oldPrice ? <span className="truncate text-muted-foreground line-through">{formatGHC(oldPrice)}</span> : null}
              {rating ? (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                  <Star size={11} className="text-warning" fill="currentColor" />
                  <span className="font-semibold text-foreground">{rating.avg.toFixed(1)}</span>({rating.count})
                </span>
              ) : null}
            </div>
          </div>

          {qty === 0 ? (
            <button
              disabled={outOfStock}
              data-add-cart
              onClick={add}
              aria-label="Add to cart"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-md transition active:scale-90 disabled:opacity-40"
            >
              <ShoppingCart size={16} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="flex shrink-0 items-center rounded-full gradient-primary text-primary-foreground shadow-md">
              <button onClick={() => updateQty(product.id, qty - 1)} aria-label="Decrease quantity" className="flex h-8 w-7 items-center justify-center">
                <Minus size={13} />
              </button>
              <span className="min-w-3 text-center text-xs font-bold">{qty}</span>
              <button disabled={atMax} onClick={() => updateQty(product.id, qty + 1)} aria-label="Increase quantity" className="flex h-8 w-7 items-center justify-center disabled:opacity-40">
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>

        {lowStock && (
          <div className="mt-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-flash/15">
              <div className="h-full rounded-full bg-flash" style={{ width: `${stockPct}%` }} />
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-flash">Only {stock} left</p>
          </div>
        )}
      </div>
    </div>
  );
}
