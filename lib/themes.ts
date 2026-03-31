export const APP_THEMES = [
  { id: "crimson", hex: "#ff716c" },
  { id: "rose", hex: "#ff8fb3" },
  { id: "amber", hex: "#efca57" },
  { id: "lime", hex: "#b9eb62" },
  { id: "emerald", hex: "#53d8a2" },
  { id: "teal", hex: "#61e2df" },
  { id: "sky", hex: "#8db9ff" },
  { id: "violet", hex: "#9d8cff" }
] as const;

export type AppThemeId = (typeof APP_THEMES)[number]["id"];

export function normalizeSelectedTheme(theme: string | null | undefined): AppThemeId {
  const known = new Set<string>(APP_THEMES.map((item) => item.id));
  return known.has(theme ?? "") ? (theme as AppThemeId) : "sky";
}
