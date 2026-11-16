export const GH_REGION_NAMES = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern",
  "Volta", "Northern", "Upper East", "Upper West", "Bono",
  "Bono East", "Ahafo", "Western North", "Oti", "Savannah", "North East",
];

/** Map a free-text state name from a map service (e.g. "Greater Accra Region") to a Kivora region. */
export function matchGhanaRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/region/g, "").replace(/-/g, " ").trim();
  if (s.includes("brong")) return s.includes("east") ? "Bono East" : "Bono";
  // longest names first so "Western North" beats "Western"
  const sorted = [...GH_REGION_NAMES].sort((a, b) => b.length - a.length);
  return sorted.find((r) => s === r.toLowerCase() || s.includes(r.toLowerCase())) ?? null;
}
