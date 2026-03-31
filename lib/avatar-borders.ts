export const AVATAR_FRAME_STYLES = [
  { id: "ring" }
] as const;

export const AVATAR_BORDER_COLORS = [
  { id: "silver", hex: "#dce8fb" },
  { id: "cobalt", hex: "#67c4ff" },
  { id: "violet", hex: "#9e8cff" },
  { id: "rose", hex: "#ff8fba" },
  { id: "crimson", hex: "#ff726b" },
  { id: "amber", hex: "#efca57" },
  { id: "lime", hex: "#b8ef63" },
  { id: "emerald", hex: "#53d8a2" },
  { id: "teal", hex: "#5edfe2" },
  { id: "onyx", hex: "#a7b7cf" }
] as const;

export const AVATAR_FRAME_TIERS = [
  { id: 0, unlockLevel: 0 },
  { id: 1, unlockLevel: 10 },
  { id: 2, unlockLevel: 25 },
  { id: 3, unlockLevel: 50 },
  { id: 4, unlockLevel: 75 },
  { id: 5, unlockLevel: 100 },
  { id: 6, unlockLevel: 125 },
  { id: 7, unlockLevel: 150 },
  { id: 8, unlockLevel: 175 },
  { id: 9, unlockLevel: 200 }
] as const;

export type AvatarFrameStyleId = (typeof AVATAR_FRAME_STYLES)[number]["id"];
export type AvatarBorderColorId = (typeof AVATAR_BORDER_COLORS)[number]["id"];
export type AvatarFrameTierId = (typeof AVATAR_FRAME_TIERS)[number]["id"];

export function getAvatarFrameTier(level: number) {
  return AVATAR_FRAME_TIERS.reduce((current, tier) => (level >= tier.unlockLevel ? tier : current), AVATAR_FRAME_TIERS[0]);
}

export function serializeAvatarBorderSelection(style: AvatarFrameStyleId, color: AvatarBorderColorId, tierId?: AvatarFrameTierId | null) {
  return `${style}:${color}:${tierId ?? ""}`;
}

export function normalizeSelectedAvatarBorder(selectedBorder: string | null | undefined) {
  const knownColors = new Set<string>(AVATAR_BORDER_COLORS.map((color) => color.id));
  const knownTiers = new Set<number>(AVATAR_FRAME_TIERS.map((tier) => tier.id));
  const [, maybeColor, maybeTier] = (selectedBorder ?? "").split(":");
  const legacy = (selectedBorder ?? "").toLowerCase();
  const fallbackColor = knownColors.has(legacy) ? (legacy as AvatarBorderColorId) : ("silver" as AvatarBorderColorId);
  const parsedTier = Number(maybeTier);

  return {
    style: "ring" as AvatarFrameStyleId,
    color: knownColors.has(maybeColor) ? (maybeColor as AvatarBorderColorId) : fallbackColor,
    tierId: Number.isFinite(parsedTier) && knownTiers.has(parsedTier) ? (parsedTier as AvatarFrameTierId) : null
  };
}

export function resolveAvatarFrameTier(level: number, selectedBorder: string | null | undefined) {
  const maxUnlockedTier = getAvatarFrameTier(level);
  const config = normalizeSelectedAvatarBorder(selectedBorder);

  if (config.tierId === null) {
    return maxUnlockedTier;
  }

  const selectedTier = AVATAR_FRAME_TIERS.find((tier) => tier.id === config.tierId) ?? maxUnlockedTier;
  return selectedTier.unlockLevel <= maxUnlockedTier.unlockLevel ? selectedTier : maxUnlockedTier;
}
