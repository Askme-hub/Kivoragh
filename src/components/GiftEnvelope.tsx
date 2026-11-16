import type { ReactNode } from "react";
import { X } from "lucide-react";

export type Perk = { tag: string; text: string };

/** Lucky-envelope style pop-up: ivory ticket card rising out of a crimson envelope. */
export function GiftEnvelope({ eyebrow, title, perks, cta, onClose }: {
  eyebrow: string; title: string; perks: Perk[]; cta: ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-foreground/60 p-4 animate-in fade-in" onClick={onClose}>
      <div className="relative w-full max-w-[340px] animate-in zoom-in-90 duration-300" onClick={(e) => e.stopPropagation()}>
        {/* floating coins */}
        <Coin className="absolute -right-3 top-24 z-30 h-12 w-12 rotate-12" />
        <Coin className="absolute -left-4 bottom-36 z-30 h-10 w-10 -rotate-12" />

        {/* envelope back */}
        <div className="absolute inset-x-0 bottom-0 top-40 rounded-3xl bg-flash shadow-2xl" />

        {/* ivory ticket card */}
        <div className="relative z-10 mx-4 rounded-t-3xl bg-card px-5 pb-24 pt-6 text-center shadow-lg">
          <div className="absolute left-1/2 top-0 h-4 w-10 -translate-x-1/2 rounded-b-full bg-foreground/60" />
          <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
          <p className="mt-1 font-display text-xl font-extrabold leading-tight text-flash">{title}</p>
          <div className="mx-auto mt-4 inline-block rounded-lg bg-flash px-6 py-2 text-lg font-extrabold text-flash-foreground shadow">🎁 Surprises</div>
          <div className="mt-4 space-y-2">
            {perks.map((p) => (
              <div key={p.tag} className="relative flex overflow-hidden rounded-md text-left">
                <div className="flex w-[42%] items-center justify-center bg-flash px-2 py-2.5 text-sm font-extrabold uppercase text-flash-foreground">{p.tag}</div>
                <div className="flex flex-1 items-center bg-flash/10 px-3 text-xs font-medium text-foreground">{p.text}</div>
                <span className="absolute left-[42%] top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card" />
                <span className="absolute bottom-0 left-[42%] h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-card" />
              </div>
            ))}
          </div>
        </div>

        {/* envelope front pocket */}
        <div className="relative z-20 -mt-20 rounded-b-3xl bg-flash px-6 pb-6 pt-10 text-center" style={{ clipPath: "ellipse(120% 100% at 50% 100%)" }}>
          <div className="mx-auto -mt-6 mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-flash-foreground/15 text-sm font-black text-flash-foreground ring-2 ring-flash-foreground/30">GH₵</div>
          {cta}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className="mt-5 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background/80 text-background">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function Coin({ className }: { className: string }) {
  return (
    <div className={`${className} flex items-center justify-center rounded-full bg-warning text-xs font-black text-warning-foreground shadow-lg ring-4 ring-warning/40`}>₵</div>
  );
}

export const envelopeCtaClass = "block w-full rounded-full bg-warning py-3 text-base font-extrabold text-flash shadow-md";
