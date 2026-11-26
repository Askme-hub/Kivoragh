import { Product, formatGHC, useShop } from "@/lib/store";
import { Heart, Star, Minus, Plus, Flame, ShoppingCart, Truck, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProductRatingsMap } from "@/lib/reviews";

function PriceTag({ value, className = "" }: { value: number; className?: string }) {
  const [whole, dec] = formatGHC(value).replace(/GH₵\s?/, "").split(".");
  return (
    <span className={`inline-flex items-baseline font-extrabold leading-none tracking-normal ${className}`}>
      <span className="mr-1 text-[10px] font-bold sm:text-[11px]">GH₵</span>
      <span className="text-lg sm:text-xl">{whole}</span>
      {dec ? <span className="text-[10px] font-bold sm:text-[11px]">.{dec}</span> : null}
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

  const oldPrice = product.oldPrice ?? (product.discount ? product.price + (product.price * product.discount) / 100 : null);
  const discount = product.discount ?? (oldPrice && oldPrice > product.price ? Math.round(((oldPrice - product.price) / oldPrice) * 100) : 0);
  const { data: ratings } = useProductRatingsMap();
  const rating = ratings?.[product.id];
  const stock = product.stock ?? 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 5;
  const atMax = qty >= stock;

  const add = () => {
    const ok = addToCart(product);
    if (ok !== false) toast.success(`${product.name} added to cart`);
  };

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card text-card-foreground shadow-soft transition duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-elevated">
      <div className="relative p-1.5 sm:p-2">
        <Link to="/products/$id" params={{ id: product.id }} className="relative block aspect-square overflow-hidden rounded-md bg-product-backdrop" aria-label={`View ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" className={`h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-110 sm:p-4 ${outOfStock ? "opacity-40 grayscale" : ""}`} />
          <span className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-sm transition group-hover:opacity-100" aria-hidden="true"><ArrowUpRight size={14} /></span>
        </Link>

        {discount > 0 && <span className="absolute left-3 top-3 rounded-lg bg-flash px-2 py-1 text-[10px] font-black tracking-normal text-flash-foreground shadow-sm sm:left-3.5 sm:top-3.5">-{discount}%</span>}
        {outOfStock && <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 bg-foreground/85 py-2 text-center text-[10px] font-extrabold uppercase tracking-normal text-background">Sold out</span>}
        <Button variant="ghost" size="icon" onClick={() => { toggleWishlist(product); toast.success(wished ? "Removed from wishlist" : "Added to wishlist"); }} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished} className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border/50 bg-card/95 shadow-sm backdrop-blur transition hover:scale-105 active:scale-90 sm:right-3.5 sm:top-3.5 ${wished ? "text-flash" : "text-stone-500 hover:text-flash"}`}>
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </Button>
        {lowStock && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-1 text-[9px] font-extrabold text-warning-ink sm:bottom-3.5 sm:left-3.5"><Flame size={10} fill="currentColor" /> LOW STOCK</span>}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5 pt-1 sm:px-3 sm:pb-3">
        <Link to="/products/$id" params={{ id: product.id }} className="line-clamp-3 min-h-[3.35rem] break-words text-[13px] font-extrabold leading-[1.12rem] text-foreground transition-colors hover:text-primary sm:line-clamp-2 sm:min-h-[2.45rem] sm:text-[13px] sm:font-bold sm:leading-[1.25rem]">{product.name}</Link>

        <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-ink sm:text-[10px]"><Truck size={12} /> Pay on delivery</span>
          {rating && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Star size={11} className="text-warning" fill="currentColor" /><b className="text-foreground">{rating.avg.toFixed(1)}</b><span>({rating.count})</span></span>}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-1 border-t border-border/60 pt-2">
          <div className="min-w-0">
            <PriceTag value={product.price} className={discount > 0 ? "text-flash" : "text-foreground"} />
            {oldPrice && <p className="mt-1 truncate text-[9px] font-medium text-muted-foreground line-through sm:text-[10px]">{formatGHC(oldPrice)}</p>}
          </div>
          {qty === 0 ? (
            <Button variant="ghost" size="icon" disabled={outOfStock} data-add-cart onClick={add} aria-label={`Add ${product.name} to cart`} className="flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-primary-foreground shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 sm:rounded-xl sm:px-0"><ShoppingCart size={14} strokeWidth={2.5} /><span className="text-[10px] font-bold sm:hidden">Add to Cart</span></Button>
          ) : (
            <div className="flex shrink-0 items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Button variant="ghost" size="icon" onClick={() => updateQty(product.id, qty - 1)} aria-label="Decrease quantity" className="flex h-8 w-7 items-center justify-center rounded-none p-0 hover:bg-primary/80 hover:text-primary-foreground"><Minus size={12} /></Button>
              <span className="min-w-3 text-center text-[11px] font-extrabold">{qty}</span>
              <Button variant="ghost" size="icon" disabled={atMax} onClick={() => updateQty(product.id, qty + 1)} aria-label="Increase quantity" className="flex h-8 w-7 items-center justify-center rounded-none p-0 hover:bg-primary/80 hover:text-primary-foreground disabled:opacity-40"><Plus size={12} /></Button>
            </div>
          )}
        </div>
        {lowStock && <p className="text-[9px] font-bold text-warning-ink">Only {stock} left in stock</p>}
      </div>
    </article>
  );
}
