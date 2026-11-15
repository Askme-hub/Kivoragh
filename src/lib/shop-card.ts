// Browser-only: draws a shop business card or social flyer onto a canvas and returns a PNG blob.
import QRCode from "qrcode";

export type CardTheme = "orange" | "slate" | "white";
export type CardFormat = "card" | "flyer";

export type CardShop = {
  shop_name: string;
  slug: string;
  logo_url?: string | null;
  location?: string | null;
  whatsapp_number?: string | null;
  phone?: string | null;
  business_category?: string | null;
  verified?: boolean;
  bio?: string | null;
};

export const SHOP_BASE_URL = "https://kivoragh.shop";

// Canvas drawing needs literal colours (no CSS variables); these mirror the brand palette.
export const CARD_THEMES: Record<CardTheme, { label: string; bg: string; bg2: string; fg: string; sub: string; accent: string; qrDark: string; qrLight: string }> = {
  orange: { label: "Kivora Orange", bg: "#F97316", bg2: "#EA580C", fg: "#FFFFFF", sub: "#FFEDD5", accent: "#18181B", qrDark: "#18181B", qrLight: "#FFFFFF" },
  slate: { label: "Dark Slate", bg: "#18181B", bg2: "#27272A", fg: "#FFFFFF", sub: "#A1A1AA", accent: "#F97316", qrDark: "#18181B", qrLight: "#FFFFFF" },
  white: { label: "Clean White", bg: "#FFFFFF", bg2: "#FFF7ED", fg: "#18181B", sub: "#52525B", accent: "#F97316", qrDark: "#18181B", qrLight: "#FFFFFF" },
};

export const shopUrl = (slug: string) => `${SHOP_BASE_URL}/shop/${slug}`;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px Outfit, Figtree, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 14);
  return s;
}

async function drawLogo(ctx: CanvasRenderingContext2D, shop: CardShop, x: number, y: number, size: number, t: (typeof CARD_THEMES)[CardTheme]) {
  ctx.save();
  roundRect(ctx, x, y, size, size, size * 0.22);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.clip();
  const img = shop.logo_url ? await loadImage(shop.logo_url) : null;
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = t.accent === "#18181B" ? "#F97316" : t.accent;
    ctx.font = `800 ${size * 0.5}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shop.shop_name.charAt(0).toUpperCase(), x + size / 2, y + size / 2);
  }
  ctx.restore();
}

async function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number, t: (typeof CARD_THEMES)[CardTheme]) {
  const qr = await QRCode.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: "H", color: { dark: t.qrDark, light: t.qrLight } });
  const img = await loadImage(qr);
  ctx.save();
  roundRect(ctx, x - 12, y - 12, size + 24, size + 24, 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  if (img) ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

function verified(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.font = `700 ${22 * scale}px Figtree, sans-serif`;
  const label = "✓ Kivora Verified";
  const w = ctx.measureText(label).width + 28 * scale;
  roundRect(ctx, x, y, w, 38 * scale, 19 * scale);
  ctx.fillStyle = "#16A34A";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 14 * scale, y + 19 * scale);
  ctx.restore();
}

export async function renderShopCard(shop: CardShop, format: CardFormat, theme: CardTheme): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const t = CARD_THEMES[theme];
  const url = shopUrl(shop.slug);
  const contact = shop.whatsapp_number || shop.phone || "";
  const canvas = document.createElement("canvas");
  const W = format === "card" ? 1050 : 1080;
  const H = format === "card" ? 600 : 1920;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // decorative circle
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = t.fg;
  ctx.beginPath();
  ctx.arc(W * 0.95, H * 0.05, W * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (format === "card") {
    // Premium layout: solid panel left, QR panel right, accent rule, no emoji.
    const panelX = 700;
    ctx.fillStyle = theme === "white" ? "#18181B" : "#FFFFFF";
    ctx.globalAlpha = theme === "white" ? 1 : 0.96;
    ctx.fillRect(panelX, 0, W - panelX, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.accent === "#18181B" ? "#18181B" : t.accent;
    ctx.fillRect(60, 214, 70, 6);
    await drawLogo(ctx, shop, 60, 60, 120, t);
    const nameSize = fitText(ctx, shop.shop_name, 580, 54);
    ctx.fillStyle = t.fg;
    ctx.fillText(shop.shop_name, 60, 290 + (54 - nameSize) / 3);
    let y = 330;
    if (shop.business_category) {
      ctx.font = "700 22px Figtree, sans-serif";
      ctx.fillStyle = t.sub;
      ctx.fillText(shop.business_category.toUpperCase().split("").join(String.fromCharCode(8202)), 60, y);
      y += 22;
    }
    if (shop.verified) { verified(ctx, 60, y, 0.9); y += 46; }
    y += 34;
    const row = (label: string, value: string) => {
      ctx.font = "700 17px Figtree, sans-serif";
      ctx.fillStyle = t.sub;
      ctx.fillText(label, 60, y);
      ctx.font = "700 27px Figtree, sans-serif";
      ctx.fillStyle = t.fg;
      ctx.fillText(value, 60, y + 32);
      y += 74;
    };
    if (contact) row("CALL / WHATSAPP", contact);
    if (shop.location && y < H - 120) row("LOCATION", shop.location);
    const panelFg = theme === "white" ? "#FFFFFF" : "#18181B";
    await drawQr(ctx, url, panelX + 75, 110, 200, { ...t, qrDark: "#18181B" });
    ctx.textAlign = "center";
    ctx.font = "800 24px Outfit, sans-serif";
    ctx.fillStyle = panelFg;
    ctx.fillText("Scan to shop", panelX + 175, 380);
    ctx.font = "600 17px Figtree, sans-serif";
    ctx.globalAlpha = 0.7;
    ctx.fillText(url.replace("https://", ""), panelX + 175, 412);
    ctx.globalAlpha = 1;
    ctx.font = "800 26px Outfit, sans-serif";
    ctx.fillStyle = "#F97316";
    ctx.fillText("KIVORA", panelX + 175, H - 70);
    ctx.font = "600 14px Figtree, sans-serif";
    ctx.fillStyle = panelFg;
    ctx.globalAlpha = 0.7;
    ctx.fillText("Ghana's trusted marketplace", panelX + 175, H - 44);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  } else {
    ctx.textAlign = "center";
    ctx.font = "800 40px Outfit, sans-serif";
    ctx.fillStyle = t.fg;
    ctx.fillText("KIVORA GH", W / 2, 130);
    await drawLogo(ctx, shop, W / 2 - 130, 220, 260, t);
    ctx.textAlign = "center";
    const nameSize = fitText(ctx, shop.shop_name, W - 140, 92);
    ctx.fillStyle = t.fg;
    ctx.fillText(shop.shop_name, W / 2, 600 + (92 - nameSize) / 3);
    let y = 660;
    if (shop.business_category) {
      ctx.font = "700 34px Figtree, sans-serif";
      ctx.fillStyle = t.sub;
      ctx.fillText(shop.business_category.toUpperCase(), W / 2, y);
      y += 30;
    }
    if (shop.verified) {
      ctx.font = "700 33px Figtree, sans-serif";
      const w = ctx.measureText("✓ Kivora Verified").width + 42;
      verified(ctx, W / 2 - w / 2, y, 1.5);
      ctx.textAlign = "center";
      y += 70;
    }
    ctx.font = "600 38px Figtree, sans-serif";
    ctx.fillStyle = t.fg;
    y += 60;
    if (shop.location) { ctx.fillText(shop.location, W / 2, y); y += 60; }
    if (contact) { ctx.fillText(`Call / WhatsApp ${contact}`, W / 2, y); y += 60; }
    await drawQr(ctx, url, W / 2 - 250, 1130, 500, t);
    ctx.textAlign = "center";
    ctx.font = "800 46px Outfit, sans-serif";
    ctx.fillStyle = t.fg;
    ctx.fillText("Scan to visit our shop", W / 2, 1745);
    ctx.font = "600 32px Figtree, sans-serif";
    ctx.fillStyle = t.sub;
    ctx.fillText(url.replace("https://", ""), W / 2, 1810);
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create image"))), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Auto-designed cover banner (1600x500) from shop details, for sellers without one. */
export async function renderShopCover(shop: CardShop): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1600, H = 500;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#F97316"); g.addColorStop(1, "#C2410C");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  for (const [x, y, r, a] of [[1450, 60, 260, 0.1], [1200, 520, 200, 0.08], [80, -40, 140, 0.07]] as const) {
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "right";
  ctx.font = "800 120px Outfit, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  const s = fitText(ctx, shop.shop_name, 900, 110);
  ctx.fillText(shop.shop_name, W - 90, 260 + (110 - s) / 3);
  ctx.font = "700 36px Figtree, sans-serif";
  ctx.fillStyle = "#FFEDD5";
  const line = [shop.business_category, shop.location].filter(Boolean).join("  •  ");
  if (line) ctx.fillText(line, W - 90, 320);
  ctx.font = "700 28px Figtree, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Shop now on Kivora", W - 90, 390);
  return c;
}

/** Monogram logo (512x512) from the shop name. */
export async function renderShopLogo(shop: CardShop): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, "#F97316"); g.addColorStop(1, "#9A3412");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(256, 256, 200, 0, Math.PI * 2); ctx.stroke();
  const initials = shop.shop_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "K";
  ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `800 ${initials.length > 1 ? 170 : 220}px Outfit, sans-serif`;
  ctx.fillText(initials, 256, 266);
  return c;
}
