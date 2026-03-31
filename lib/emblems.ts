import { buildStats } from "./stats";
import type { ClimbRow } from "./types";

export const EMBLEM_DEFINITIONS = [
  { id: "first_send", name: "First Send", mark: "FS", tone: "gold", description: "Log your first completed climb." },
  { id: "flash_start", name: "Flash Start", mark: "FL", tone: "teal", description: "Log your first flash." },
  { id: "volume_25", name: "Volume 25", mark: "25", tone: "blue", description: "Complete 25 climbs." },
  { id: "volume_100", name: "Century Club", mark: "100", tone: "violet", description: "Complete 100 climbs." },
  { id: "v3_breaker", name: "V3 Breaker", mark: "V3", tone: "red", description: "Send a V3 or harder." },
  { id: "v5_hunter", name: "V5 Hunter", mark: "V5", tone: "orange", description: "Send a V5 or harder." },
  { id: "v7_legend", name: "V7 Legend", mark: "V7", tone: "pink", description: "Send a V7 or harder." },
  { id: "slab_sage", name: "Slab Sage", mark: "SL", tone: "mint", description: "Log 10 slab climbs." },
  { id: "roof_raider", name: "Roof Raider", mark: "RF", tone: "indigo", description: "Log 8 roof or overhang climbs." },
  { id: "crimp_crafter", name: "Crimp Crafter", mark: "CR", tone: "cyan", description: "Log 10 crimpy climbs." },
  { id: "flash_machine", name: "Flash Machine", mark: "F10", tone: "lime", description: "Flash 10 climbs." },
  { id: "rainbow_run", name: "Rainbow Run", mark: "RB", tone: "sunset", description: "Log 5 different climb colors." },
  { id: "show_up", name: "Show Up", mark: "30D", tone: "silver", description: "Climb on 8 different days in the last 30 days." },
  { id: "all_rounder", name: "All-Rounder", mark: "AR", tone: "emerald", description: "Log climbs across 6 different style tags." }
] as const;

export type EmblemId = (typeof EMBLEM_DEFINITIONS)[number]["id"];
export type EmblemTone = (typeof EMBLEM_DEFINITIONS)[number]["tone"];

export function getUnlockedEmblems(climbs: ClimbRow[]) {
  const stats = buildStats(climbs);
  const completedClimbs = climbs.filter((climb) => climb.status === "completed");
  const flashedCount = completedClimbs.filter((climb) => climb.flashed).length;
  const colorCount = new Set(completedClimbs.map((climb) => (climb.wall_name ?? "").trim().toLowerCase()).filter(Boolean)).size;
  const tagCount = new Set(completedClimbs.flatMap((climb) => climb.style_tags)).size;
  const recentActiveDays = countRecentActiveDays(completedClimbs, 30);
  const overhangAndRoofCount = completedClimbs.filter((climb) => climb.style_tags.includes("roof") || climb.style_tags.includes("overhang")).length;
  const personalBestRank = gradeRank(extractBaseGrade(stats.personalBest));

  const unlocked = new Set<EmblemId>();

  if (completedClimbs.length >= 1) unlocked.add("first_send");
  if (flashedCount >= 1) unlocked.add("flash_start");
  if (completedClimbs.length >= 25) unlocked.add("volume_25");
  if (completedClimbs.length >= 100) unlocked.add("volume_100");
  if (personalBestRank >= gradeRank("V3")) unlocked.add("v3_breaker");
  if (personalBestRank >= gradeRank("V5")) unlocked.add("v5_hunter");
  if (personalBestRank >= gradeRank("V7")) unlocked.add("v7_legend");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("slab")).length >= 10) unlocked.add("slab_sage");
  if (overhangAndRoofCount >= 8) unlocked.add("roof_raider");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("crimpy")).length >= 10) unlocked.add("crimp_crafter");
  if (flashedCount >= 10) unlocked.add("flash_machine");
  if (colorCount >= 5) unlocked.add("rainbow_run");
  if (recentActiveDays >= 8) unlocked.add("show_up");
  if (tagCount >= 6) unlocked.add("all_rounder");

  return EMBLEM_DEFINITIONS.filter((emblem) => unlocked.has(emblem.id));
}

export function normalizeSelectedEmblems(selected: string[] | null | undefined, unlockedIds: string[]) {
  const unlocked = new Set(unlockedIds);
  const unique = Array.from(new Set(selected ?? []));
  return unique.filter((id) => unlocked.has(id)).slice(0, 3);
}

function countRecentActiveDays(climbs: ClimbRow[], days: number) {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (days - 1));

  return new Set(
    climbs
      .filter((climb) => new Date(`${climb.climbed_on}T00:00:00`) >= threshold)
      .map((climb) => climb.climbed_on)
  ).size;
}

function extractBaseGrade(personalBest: string) {
  const match = personalBest.match(/VB|V10|V[0-9]/);
  return (match?.[0] ?? "VB") as "VB" | "V0" | "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10";
}

function gradeRank(grade: "VB" | "V0" | "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10") {
  return ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"].indexOf(grade);
}
