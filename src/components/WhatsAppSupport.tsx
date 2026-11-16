import { useRouterState } from "@tanstack/react-router";

// Kivora customer care WhatsApp number (international format, digits only).
export const SUPPORT_WHATSAPP = "233257573471";

const HIDDEN = ["/cart", "/checkout", "/messages", "/login", "/payment"];

function WaIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.004 3C9.38 3 4 8.38 4 15.004c0 2.12.555 4.19 1.61 6.01L4 29l8.17-1.57A11.95 11.95 0 0 0 16.004 27C22.62 27 28 21.62 28 15.004 28 8.38 22.62 3 16.004 3Zm0 21.8c-1.85 0-3.66-.5-5.24-1.44l-.37-.22-4.85.93.96-4.73-.24-.38a9.78 9.78 0 0 1-1.5-5.26c0-5.42 4.41-9.83 9.84-9.83 5.42 0 9.83 4.41 9.83 9.83 0 5.42-4.41 9.84-9.83 9.84Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function WhatsAppSupport() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN.some((p) => path.startsWith(p))) return null;
  const onProduct = path.startsWith("/products/");
  const text = encodeURIComponent(`Hi Kivora, I need help${onProduct ? ` with this item: https://kivoragh.shop${path}` : ""}`);
  // Sit above the phone tab bar, and above the sticky buy bar on product pages.
  const pos = onProduct
    ? "bottom-[calc(160px+env(safe-area-inset-bottom))] lg:bottom-6"
    : "bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6";
  return (
    <a
      href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Kivora support on WhatsApp"
      className={`group fixed right-3 md:right-6 ${pos} z-40 print:hidden`}
    >
      <span className="relative flex items-center gap-3 rounded-full bg-success text-success-foreground shadow-elevated ring-4 ring-success/20 transition-transform active:scale-95 md:hover:-translate-y-0.5 h-14 w-14 justify-center md:h-auto md:w-auto md:justify-start md:py-2 md:pl-2 md:pr-5">
        <span className="absolute inset-0 rounded-full bg-success/40 animate-ping [animation-duration:2.5s] md:hidden" />
        <span className="relative grid h-14 w-14 place-items-center md:h-11 md:w-11 md:rounded-full md:bg-success-foreground/15">
          <WaIcon className="h-8 w-8 md:h-6 md:w-6" />
          <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-success bg-success-foreground md:right-0 md:top-0" />
        </span>
        <span className="relative hidden flex-col leading-tight md:flex">
          <span className="text-sm font-extrabold">Need help?</span>
          <span className="text-[11px] font-medium opacity-90">Chat with us · 025 757 3471</span>
        </span>
      </span>
    </a>
  );
}
