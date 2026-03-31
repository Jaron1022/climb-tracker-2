import { buildStats } from "./stats";
import type { ClimbRow } from "./types";

export const EMBLEM_DEFINITIONS = [
  { id: "first_send", name: "First Send", icon: "flag", tone: "gold", family: "milestone", tier: 1, description: "Log your first completed climb." },
  { id: "flash_start", name: "Flash Start", icon: "bolt", tone: "teal", family: "flash", tier: 1, description: "Log your first flash." },
  { id: "volume_25", name: "Volume 25", icon: "stack", tone: "blue", family: "volume", tier: 1, description: "Complete 25 climbs." },
  { id: "volume_100", name: "Century Club", icon: "crown", tone: "violet", family: "volume", tier: 2, description: "Complete 100 climbs." },
  { id: "volume_250", name: "Mileage Monster", icon: "medal", tone: "sunset", family: "volume", tier: 3, description: "Complete 250 climbs." },
  { id: "v3_breaker", name: "V3 Breaker", icon: "peak", tone: "red", family: "grade", tier: 1, description: "Send a V3 or harder." },
  { id: "v5_hunter", name: "V5 Hunter", icon: "peak", tone: "orange", family: "grade", tier: 2, description: "Send a V5 or harder." },
  { id: "v7_legend", name: "V7 Legend", icon: "star", tone: "pink", family: "grade", tier: 3, description: "Send a V7 or harder." },
  { id: "level_10", name: "Level 10", icon: "shield", tone: "indigo", family: "level", tier: 1, description: "Reach level 10." },
  { id: "level_20", name: "Level 20", icon: "shield", tone: "emerald", family: "level", tier: 2, description: "Reach level 20." },
  { id: "slab_sage", name: "Slab Sage", icon: "triangle", tone: "mint", family: "style", tier: 1, description: "Log 10 slab climbs." },
  { id: "roof_raider", name: "Roof Raider", icon: "roof", tone: "indigo", family: "style", tier: 1, description: "Log 8 roof or overhang climbs." },
  { id: "crimp_crafter", name: "Crimp Crafter", icon: "diamond", tone: "cyan", family: "style", tier: 1, description: "Log 10 crimpy climbs." },
  { id: "pocket_ace", name: "Pocket Ace", icon: "ring", tone: "silver", family: "style", tier: 1, description: "Log 8 pocket climbs." },
  { id: "undercling_engine", name: "Undercling Engine", icon: "arrow-up", tone: "blue", family: "style", tier: 1, description: "Log 8 undercling climbs." },
  { id: "dynamic_driver", name: "Dynamic Driver", icon: "comet", tone: "red", family: "movement", tier: 1, description: "Log 8 dynamic climbs." },
  { id: "static_control", name: "Static Control", icon: "plus", tone: "mint", family: "movement", tier: 1, description: "Log 8 static climbs." },
  { id: "flash_machine", name: "Flash Machine", icon: "bolt", tone: "lime", family: "flash", tier: 2, description: "Flash 10 climbs." },
  { id: "rainbow_run", name: "Rainbow Run", icon: "spark", tone: "sunset", family: "color", tier: 1, description: "Log 5 different climb colors." },
  { id: "show_up", name: "Show Up", icon: "calendar", tone: "silver", family: "consistency", tier: 1, description: "Climb on 8 different days in the last 30 days." },
  { id: "all_rounder", name: "All-Rounder", icon: "compass", tone: "emerald", family: "mastery", tier: 1, description: "Log climbs across 6 different style tags." }
] as const;

export type EmblemId = (typeof EMBLEM_DEFINITIONS)[number]["id"];
export type EmblemTone = (typeof EMBLEM_DEFINITIONS)[number]["tone"];
export type EmblemFamily = (typeof EMBLEM_DEFINITIONS)[number]["family"];

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
  if (completedClimbs.length >= 250) unlocked.add("volume_250");
  if (personalBestRank >= gradeRank("V3")) unlocked.add("v3_breaker");
  if (personalBestRank >= gradeRank("V5")) unlocked.add("v5_hunter");
  if (personalBestRank >= gradeRank("V7")) unlocked.add("v7_legend");
  if (stats.level >= 10) unlocked.add("level_10");
  if (stats.level >= 20) unlocked.add("level_20");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("slab")).length >= 10) unlocked.add("slab_sage");
  if (overhangAndRoofCount >= 8) unlocked.add("roof_raider");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("crimpy")).length >= 10) unlocked.add("crimp_crafter");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("pockets")).length >= 8) unlocked.add("pocket_ace");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("undercling")).length >= 8) unlocked.add("undercling_engine");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("dynamic")).length >= 8) unlocked.add("dynamic_driver");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("static")).length >= 8) unlocked.add("static_control");
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
