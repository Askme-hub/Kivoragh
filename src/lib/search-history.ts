const STORAGE_KEY = "kivora:recent-searches";
const MAX_RECENT_SEARCHES = 8;

/** Recent searches are stored on this device in the shopper's browser. */
export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(term: string): string[] {
  const value = term.trim().replace(/\\s+/g, " ");
  if (!value || typeof window === "undefined") return getRecentSearches();
  const next = [value, ...getRecentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())]
    .slice(0, MAX_RECENT_SEARCHES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Search still works when browser storage is unavailable or full.
  }
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const next = getRecentSearches().filter((item) => item !== term);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore unavailable browser storage.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}
