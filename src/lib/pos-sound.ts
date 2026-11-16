let ctx: AudioContext | null = null;
export function isPosSoundOn() {
  return typeof window !== "undefined" && localStorage.getItem("pos-sound") !== "off";
}
export function setPosSound(on: boolean) {
  localStorage.setItem("pos-sound", on ? "on" : "off");
}
function tone(freq: number, start: number, dur: number, vol = 0.12) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}
function ready() {
  if (!isPosSoundOn()) return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return true;
  } catch {
    return false;
  }
}
export function beep() {
  if (ready()) tone(1800, 0, 0.09);
}
export function errorBuzz() {
  if (ready()) tone(220, 0, 0.25, 0.1);
}
export function chime() {
  if (!ready()) return;
  tone(880, 0, 0.15, 0.08);
  tone(1320, 0.12, 0.25, 0.08);
}
