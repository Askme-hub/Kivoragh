import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, SendHorizonal, X, Store, User, ChevronDown, Reply, Tag, ShieldCheck, BadgeCheck, AlertTriangle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { encodeProductTag, parseProductTag, looksRisky } from "@/lib/chat-product";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useMessages,
  useSendMessage,
  markConversationRead,
  markConversationDelivered,
  useChatPresence,
  formatLastSeen,
  type Conversation,
  type ChatMessage,
} from "@/lib/messages";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function ChatAvatar({
  name,
  size = "md",
  className,
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = (name ?? "K").charAt(0).toUpperCase();
  const dim =
    size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary",
        dim,
        className,
      )}
    >
      {initial}
    </span>
  );
}

/** WhatsApp-style ticks: sent → delivered → read */
function MessageTicks({
  delivered,
  read,
  onPrimary,
}: {
  delivered: boolean;
  read: boolean;
  onPrimary?: boolean;
}) {
  if (read) {
    return (
      <CheckCheck
        size={16}
        strokeWidth={2.75}
        className={cn("shrink-0", onPrimary ? "text-sky-200" : "text-sky-500")}
        aria-label="Read"
      />
    );
  }
  if (delivered) {
    return (
      <CheckCheck
        size={14}
        className={cn(
          "shrink-0 opacity-80",
          onPrimary ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
        aria-label="Delivered"
      />
    );
  }
  return (
    <Check
      size={14}
      className={cn(
        "shrink-0 opacity-70",
        onPrimary ? "text-primary-foreground/70" : "text-muted-foreground",
      )}
      aria-label="Sent"
    />
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByDay(messages: ChatMessage[]) {
  const groups: { label: string; items: ChatMessage[] }[] = [];
  let current = "";
  for (const m of messages) {
    const label = dayLabel(m.created_at);
    if (label !== current) {
      groups.push({ label, items: [m] });
      current = label;
    } else {
      groups[groups.length - 1].items.push(m);
    }
  }
  return groups;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 px-0.5" aria-label="Typing">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

/** Profile sheet — WhatsApp-style contact view */
function ChatProfileSheet({
  open,
  onClose,
  name,
  shopName,
  shopSlug,
  isSeller,
  online,
  lastSeenAt,
  typing,
}: {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  shopName?: string | null;
  shopSlug?: string | null;
  isSeller: boolean;
  online: boolean;
  lastSeenAt: string | null;
  typing: boolean;
}) {
  if (!open) return null;

  const status = typing
    ? "typing…"
    : online
      ? "Online"
      : formatLastSeen(lastSeenAt);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/50" onClick={onClose}>
      <div
        className="mt-auto max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card shadow-elevated md:mx-auto md:mt-16 md:max-h-[80vh] md:w-full md:max-w-md md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <h2 className="text-base font-bold text-foreground">Contact info</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pb-6 pt-8">
          <ChatAvatar name={name} size="lg" className="ring-4 ring-primary/10" />
          <h3 className="mt-4 text-center text-xl font-extrabold text-foreground">
            {name || "Kivora user"}
          </h3>
          {shopName && shopName !== name && (
            <p className="mt-1 text-sm text-muted-foreground">{shopName}</p>
          )}
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              typing || online ? "text-success" : "text-muted-foreground",
            )}
          >
            {status}
          </p>
        </div>

        <div className="space-y-1 border-t border-border px-3 py-3">
          {isSeller && shopSlug && (
            <Link
              to="/shop/$slug"
              params={{ slug: shopSlug }}
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Store size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">View shop</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {shopName || name}
                </span>
              </span>
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <User size={18} />
            </span>
            <span>
              <span className="block font-semibold text-foreground">
                {isSeller ? "Seller on Kivora" : "Buyer on Kivora"}
              </span>
              <span className="block text-xs">Chat is only for this order or product inquiry</span>
            </span>
          </div>
        </div>

        <div className="border-t border-border px-4 py-4">
          <p className="text-center text-[11px] text-muted-foreground">
            Messages are private between you and this contact.
          </p>
        </div>
      </div>
    </div>
  );
}

type TagProduct = { id: string; name: string; price: number; old_price: number | null; image_url: string | null; stock: number };
const PRODUCT_COLS = "id, name, price, old_price, image_url, stock";

function useTaggedProducts(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["chat-products", key],
    enabled: key.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("products").select(PRODUCT_COLS).in("id", key);
      return new Map(((data ?? []) as TagProduct[]).map((p) => [p.id, p]));
    },
  });
}

function ghs(n: number) {
  return `GH₵ ${Number(n).toLocaleString("en-GH", { maximumFractionDigits: 2 })}`;
}

function ProductChip({ p, mine, compact }: { p: TagProduct | undefined; mine?: boolean; compact?: boolean }) {
  if (!p) {
    return <div className={cn("mb-1 rounded-xl px-3 py-2 text-xs", mine ? "bg-primary-foreground/15" : "bg-muted")}>Product no longer available</div>;
  }
  const inner = (
    <div className={cn("flex items-center gap-2.5 rounded-xl p-1.5 pr-3 text-left", mine ? "bg-primary-foreground/15" : "border border-border bg-muted/60", !compact && "mb-1")}>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-background">
        {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{p.name}</p>
        <p className="mt-0.5 text-sm font-extrabold">
          {ghs(p.price)}
          {p.old_price && p.old_price > p.price && <span className="ml-1.5 text-[11px] font-normal line-through opacity-70">{ghs(p.old_price)}</span>}
        </p>
        <p className="text-[10px] font-semibold opacity-80">{p.stock > 0 ? (p.stock <= 5 ? `Only ${p.stock} left` : "In stock") : "Sold out"}</p>
      </div>
    </div>
  );
  if (compact) return inner;
  return <Link to="/products/$id" params={{ id: p.id }} className="block">{inner}</Link>;
}

function ProductPicker({ open, onClose, sellerId, onPick }: { open: boolean; onClose: () => void; sellerId: string; onPick: (p: TagProduct) => void }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["chat-picker", sellerId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("products").select(PRODUCT_COLS).eq("seller_id", sellerId).eq("approval_status", "approved").order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as TagProduct[];
    },
  });
  if (!open) return null;
  const list = (data ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/50" onClick={onClose}>
      <div className="mt-auto flex max-h-[80dvh] flex-col rounded-t-3xl bg-card shadow-elevated md:mx-auto md:mt-20 md:w-full md:max-w-md md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Tag a product</h2>
            <p className="text-[11px] text-muted-foreground">Show exactly which item you mean</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-4 pt-3">
          <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <Search size={16} className="text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this shop's products" className="flex-1 bg-transparent text-sm text-foreground outline-none" />
          </label>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No products found</p>
          ) : (
            list.map((p) => (
              <button key={p.id} type="button" onClick={() => { onPick(p); onClose(); }} className="block w-full text-foreground active:scale-[0.99]">
                <ProductChip p={p} compact />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SafetyNote() {
  return (
    <div className="mx-auto my-2 flex max-w-md items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-foreground">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
      <span><b>Chat safely on Kivora.</b> Pay on delivery and keep your chat here — your messages help us protect you if anything goes wrong. Never send MoMo before you receive your item.</span>
    </div>
  );
}

export function ChatThread({
  conversation,
  userId,
  onBack,
}: {
  conversation: Conversation;
  userId: string;
  onBack?: () => void;
}) {
  const isCustomer = conversation.customer_id === userId;
  const otherUserId = isCustomer ? conversation.seller_id : conversation.customer_id;
  const otherIsSeller = isCustomer; // if I'm customer, other is seller

  const { data: messages, isLoading } = useMessages(conversation.id, userId);
  const send = useSendMessage(conversation.id);
  const { partner, notifyTyping, notifyStoppedTyping } = useChatPresence(
    conversation.id,
    userId,
    otherUserId,
  );

  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<TagProduct | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const byId = useMemo(() => new Map((messages ?? []).map((m) => [m.id, m])), [messages]);
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    setTimeout(() => setFlashId(null), 1500);
  };
  const nameOf = (m: ChatMessage) => (m.sender_id === userId ? "You" : conversation.other_name || "Them");
  const [profileOpen, setProfileOpen] = useState(false);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const [viewportH, setViewportH] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load seller slug for profile → shop link
  useEffect(() => {
    if (!otherIsSeller) {
      setShopSlug(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("seller_profiles")
        .select("slug")
        .eq("user_id", otherUserId)
        .maybeSingle();
      if (!cancelled) setShopSlug(data?.slug ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [otherIsSeller, otherUserId]);

  // Lock body scroll only on mobile full-screen chat
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keep layout stable when mobile keyboard opens (stops header jump)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      // How much the keyboard is covering the layout viewport
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardPad(covered > 40 ? covered : 0);
      setViewportH(vv.height);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [
    messages?.length,
    messages?.[messages.length - 1]?.read,
    messages?.[messages.length - 1]?.delivered,
    partner.typing,
  ]);

  useEffect(() => {
    void markConversationDelivered(conversation.id, userId);
    void markConversationRead(conversation.id, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Focus composer shortly after open so users see the input quickly
  useEffect(() => {
    const t = window.setTimeout(() => {
      // Don't steal focus on desktop multi-pane
      if (window.matchMedia("(max-width: 767px)").matches) {
        textareaRef.current?.focus({ preventScroll: true });
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [conversation.id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(dist > 140);
  };

  const groups = useMemo(() => groupByDay(messages ?? []), [messages]);
  const lastMineId = useMemo(() => {
    const list = messages ?? [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].sender_id === userId) return list[i].id;
    return null;
  }, [messages, userId]);
  const taggedIds = useMemo(() => {
    const ids = (messages ?? []).map((m) => parseProductTag(m.body).productId).filter(Boolean) as string[];
    if (conversation.product_id) ids.push(conversation.product_id);
    return ids;
  }, [messages, conversation.product_id]);
  const { data: productMap } = useTaggedProducts(taggedIds);
  const contextProduct = conversation.product_id ? productMap?.get(conversation.product_id) : undefined;

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase.rpc("public_seller_badge", { _seller_id: conversation.seller_id });
      const row = Array.isArray(data) ? data[0] : data;
      if (!off) setVerified(!!row?.verified);
    })();
    return () => { off = true; };
  }, [conversation.seller_id]);

  const statusLine = partner.typing
    ? "typing…"
    : partner.online
      ? "Online"
      : formatLastSeen(partner.lastSeenAt);

  const displayName = conversation.other_name || conversation.other_shop || "Kivora user";

  const submit = () => {
    if ((!text.trim() && !tagged) || send.isPending) return;
    notifyStoppedTyping();
    send.mutate(
      { body: tagged ? encodeProductTag(tagged.id, text) : text, senderId: userId, replyToId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setText("");
          setReplyTo(null);
          setTagged(null);
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
          requestAnimationFrame(() => scrollToBottom(true));
        },
        onError: (e: unknown) => {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === "object" && e && "message" in e
                ? String((e as { message: unknown }).message)
                : "Couldn't send message";
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col bg-background md:static md:inset-auto md:z-auto md:h-[calc(100dvh-11rem)]"
      style={
        viewportH != null
          ? { height: viewportH, bottom: "auto" }
          : { height: "100dvh", bottom: 0 }
      }
    >
      {/* Fixed flex header — does not jump with keyboard */}
      <header className="z-20 flex shrink-0 items-center gap-1 border-b border-border bg-card px-1.5 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm md:gap-2 md:px-3 md:pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-full p-2.5 text-foreground active:bg-muted md:hidden"
            aria-label="Back"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left active:bg-muted/60"
        >
          <div className="relative shrink-0">
            <ChatAvatar name={displayName} />
            {partner.online && (
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success"
                title="Online"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-foreground">
              {displayName}
              {otherIsSeller && verified && <BadgeCheck size={15} className="ml-1 inline -mt-0.5 text-primary" aria-label="Verified seller" />}
            </p>
            <p
              className={cn(
                "truncate text-[11px] leading-tight",
                partner.typing
                  ? "font-medium text-primary"
                  : partner.online
                    ? "font-medium text-success"
                    : "text-muted-foreground",
              )}
            >
              {partner.typing ? (
                <span className="inline-flex items-center gap-1.5">
                  typing <TypingDots />
                </span>
              ) : (
                statusLine
              )}
            </p>
          </div>
        </button>
      </header>
      {contextProduct && (
        <div className="shrink-0 border-b border-border bg-card px-3 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">About</span>
            <div className="min-w-0 flex-1 text-foreground"><ProductChip p={contextProduct} compact /></div>
            <Link to="/products/$id" params={{ id: contextProduct.id }} className="shrink-0 rounded-full gradient-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">View</Link>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.06) 1px, transparent 0)",
          backgroundSize: "18px 18px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <SafetyNote />
        {isLoading ? (
          <div className="space-y-2 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-10 max-w-[70%] animate-pulse rounded-2xl bg-foreground/10 ${i % 2 ? "ml-auto" : ""}`}
              />
            ))}
          </div>
        ) : (messages?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-12 text-center">
            <button type="button" onClick={() => setProfileOpen(true)}>
              <ChatAvatar name={displayName} size="lg" />
            </button>
            <p className="mt-3 text-sm font-semibold text-foreground">{displayName}</p>
            <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
              Say hello — your conversation starts here. You’ll see when they receive and read your
              messages.
            </p>
            <button
              type="button"
              onClick={() => textareaRef.current?.focus()}
              className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-primary shadow-sm"
            >
              Type a message
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <div className="sticky top-1 z-[1] flex justify-center py-1.5">
                <span className="rounded-full border border-border/80 bg-card/90 px-3 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
                  {g.label}
                </span>
              </div>
              {g.items.map((m, idx) => {
                const mine = m.sender_id === userId;
                const prev = g.items[idx - 1];
                const next = g.items[idx + 1];
                const sameAsPrev = prev && prev.sender_id === m.sender_id;
                const sameAsNext = next && next.sender_id === m.sender_id;
                return (
                  <div key={m.id}>
                  <div
                    id={`msg-${m.id}`}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg transition-colors",
                      flashId === m.id && "bg-primary/15",
                      mine ? "justify-end" : "justify-start",
                      sameAsPrev ? "mt-0.5" : "mt-1.5",
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[88%] px-3 py-1.5 text-[15px] leading-snug shadow-sm sm:max-w-[75%]",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-foreground",
                        mine
                          ? sameAsNext
                            ? "rounded-2xl rounded-br-md"
                            : "rounded-2xl rounded-br-sm"
                          : sameAsNext
                            ? "rounded-2xl rounded-bl-md"
                            : "rounded-2xl rounded-bl-sm",
                      )}
                    >
                      {m.reply_to_id && (() => {
                        const q = byId.get(m.reply_to_id);
                        return (
                          <button
                            type="button"
                            onClick={() => q && jumpTo(q.id)}
                            className={cn(
                              "mb-1 block w-full rounded-md border-l-4 px-2 py-1 text-left text-xs",
                              mine ? "border-primary-foreground/70 bg-primary-foreground/15" : "border-primary bg-muted",
                            )}
                          >
                            <span className="block font-bold">{q ? nameOf(q) : "Message"}</span>
                            <span className="line-clamp-2 opacity-80">{q ? parseProductTag(q.body).text || "🏷️ Product" : "Original message unavailable"}</span>
                          </button>
                        );
                      })()}
                      {(() => {
                        const { productId, text: t } = parseProductTag(m.body);
                        return (
                          <>
                            {productId && <ProductChip p={productMap?.get(productId)} mine={mine} />}
                            {t && <p className="whitespace-pre-wrap break-words">{t}</p>}
                            {!mine && t && looksRisky(t) && (
                              <p className="mt-1 flex items-start gap-1 rounded-md bg-flash/10 px-2 py-1 text-[11px] font-semibold text-flash">
                                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Careful: don't pay before delivery. Use Pay on Delivery on Kivora.
                              </p>
                            )}
                          </>
                        );
                      })()}
                      <div
                        className={cn(
                          "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                          mine ? "text-primary-foreground/75" : "text-muted-foreground",
                        )}
                      >
                        <span>
                          {new Date(m.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {mine && (
                          <MessageTicks
                            delivered={!!m.delivered}
                            read={!!m.read}
                            onPrimary
                          />
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setReplyTo(m); textareaRef.current?.focus(); }}
                      aria-label="Reply to this message"
                      className={cn(
                        "shrink-0 rounded-full p-1.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 md:opacity-0 md:group-hover:opacity-100",
                        mine && "order-first",
                      )}
                    >
                      <Reply size={16} />
                    </button>
                  </div>
                  {mine && m.id === lastMineId && (
                    <p className="mr-1 mt-0.5 text-right text-[11px] font-medium text-muted-foreground" aria-live="polite">
                      {m.read ? (
                        <span className="font-semibold text-sky-500">✓✓ Seen</span>
                      ) : m.delivered ? (
                        "✓✓ Delivered"
                      ) : (
                        "✓ Sent"
                      )}
                    </p>
                  )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {partner.typing && (
          <div className="flex justify-start pt-1">
            <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-2.5 text-muted-foreground shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Jump to latest */}
      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground shadow-md active:scale-95 md:bottom-28"
          aria-label="Jump to latest messages"
        >
          <ChevronDown size={18} />
        </button>
      )}

      {/* Composer — lifted, always visible above keyboard */}
      <div
        className="z-20 shrink-0 border-t border-border bg-card px-2 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:px-3"
        style={{
          paddingBottom: keyboardPad > 0
            ? 8
            : "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {replyTo && (
          <div className="mx-auto mb-2 flex max-w-3xl items-start gap-2 rounded-lg border-l-4 border-primary bg-muted px-3 py-2">
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-bold text-primary">Replying to {nameOf(replyTo)}</p>
              <p className="truncate text-muted-foreground">{parseProductTag(replyTo.body).text || "🏷️ Product"}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="rounded-full p-1 text-muted-foreground hover:bg-background">
              <X size={16} />
            </button>
          </div>
        )}
        {tagged && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2">
            <div className="min-w-0 flex-1 text-foreground"><ProductChip p={tagged} compact /></div>
            <button type="button" onClick={() => setTagged(null)} aria-label="Remove tagged product" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X size={16} /></button>
          </div>
        )}
        {!text.trim() && !replyTo && !tagged && (
          <div className="mx-auto mb-2 flex max-w-3xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {(otherIsSeller
              ? ["Is this still available?", "What's the last price?", "Do you deliver to my area?", "When can I get it?"]
              : ["Yes, it's available ✅", "Thanks for your order!", "I'll deliver today", "Please confirm your location"]
            ).map((q) => (
              <button key={q} type="button" onClick={() => { setText(q); textareaRef.current?.focus(); }} className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary active:scale-95">
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary active:scale-95"
            aria-label="Tag a product"
            title="Tag a product"
          >
            <Tag size={18} />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
              if (e.target.value.trim()) notifyTyping();
              else notifyStoppedTyping();
            }}
            onFocus={() => {
              // Keep latest messages visible when focusing input
              setTimeout(() => scrollToBottom(true), 250);
            }}
            onBlur={() => notifyStoppedTyping()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={tagged ? "Ask about this product…" : "Type a message"}
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-3xl border border-border bg-background px-4 py-2.5 text-[15px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="button"
            onClick={submit}
            disabled={(!text.trim() && !tagged) || send.isPending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full gradient-primary text-primary-foreground shadow-md transition active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <SendHorizonal size={18} />
          </button>
        </div>
        <p className="mx-auto mt-1 max-w-3xl px-1 text-[10px] text-muted-foreground">
          Tap 🏷️ to tag a product · Enter to send
        </p>
      </div>

      <ProductPicker open={pickerOpen} onClose={() => setPickerOpen(false)} sellerId={conversation.seller_id} onPick={setTagged} />
      <ChatProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        name={displayName}
        shopName={conversation.other_shop}
        shopSlug={shopSlug}
        isSeller={otherIsSeller}
        online={partner.online}
        lastSeenAt={partner.lastSeenAt}
        typing={partner.typing}
      />
    </div>
  );
}
