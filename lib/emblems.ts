import { buildStats } from "./stats";
import type { ClimbRow } from "./types";

export const EMBLEM_DEFINITIONS = [
  { id: "first_send", name: "First Send", icon: "flag", tone: "gold", family: "milestone", tier: 1, description: "Log your first completed climb." },
  { id: "first_week", name: "First Week", icon: "calendar", tone: "silver", family: "consistency", tier: 1, description: "Climb on 3 different days in the last 30 days." },
  { id: "flash_start", name: "Flash Start", icon: "bolt", tone: "teal", family: "flash", tier: 1, description: "Log your first flash." },
  { id: "flash_five", name: "Flash Five", icon: "bolt", tone: "cyan", family: "flash", tier: 1, description: "Flash 5 climbs." },
  { id: "volume_25", name: "Volume 25", icon: "stack", tone: "blue", family: "volume", tier: 1, description: "Complete 25 climbs." },
  { id: "volume_100", name: "Century Club", icon: "crown", tone: "violet", family: "volume", tier: 2, description: "Complete 100 climbs." },
  { id: "volume_250", name: "Mileage Monster", icon: "medal", tone: "sunset", family: "volume", tier: 3, description: "Complete 250 climbs." },
  { id: "volume_500", name: "Big Wall Logbook", icon: "medal", tone: "gold", family: "volume", tier: 3, description: "Complete 500 climbs." },
  { id: "v1_breaker", name: "V1 Breaker", icon: "peak", tone: "orange", family: "grade", tier: 1, description: "Send a V1 or harder." },
  { id: "v2_breaker", name: "V2 Breaker", icon: "peak", tone: "red", family: "grade", tier: 1, description: "Send a V2 or harder." },
  { id: "v3_breaker", name: "V3 Breaker", icon: "peak", tone: "red", family: "grade", tier: 1, description: "Send a V3 or harder." },
  { id: "v4_chaser", name: "V4 Chaser", icon: "peak", tone: "pink", family: "grade", tier: 2, description: "Send a V4 or harder." },
  { id: "v5_hunter", name: "V5 Hunter", icon: "peak", tone: "orange", family: "grade", tier: 2, description: "Send a V5 or harder." },
  { id: "v6_hunter", name: "V6 Hunter", icon: "star", tone: "violet", family: "grade", tier: 2, description: "Send a V6 or harder." },
  { id: "v7_legend", name: "V7 Legend", icon: "star", tone: "pink", family: "grade", tier: 3, description: "Send a V7 or harder." },
  { id: "v8_orbit", name: "V8 Orbit", icon: "star", tone: "sunset", family: "grade", tier: 3, description: "Send a V8 or harder." },
  { id: "level_5", name: "Level 5", icon: "shield", tone: "blue", family: "level", tier: 1, description: "Reach level 5." },
  { id: "level_10", name: "Level 10", icon: "shield", tone: "indigo", family: "level", tier: 1, description: "Reach level 10." },
  { id: "level_20", name: "Level 20", icon: "shield", tone: "emerald", family: "level", tier: 2, description: "Reach level 20." },
  { id: "level_30", name: "Level 30", icon: "shield", tone: "gold", family: "level", tier: 3, description: "Reach level 30." },
  { id: "slab_sampler", name: "Slab Sampler", icon: "triangle", tone: "cyan", family: "style", tier: 1, description: "Log 5 slab climbs." },
  { id: "slab_sage", name: "Slab Sage", icon: "triangle", tone: "mint", family: "style", tier: 1, description: "Log 10 slab climbs." },
  { id: "overhang_operator", name: "Overhang Operator", icon: "roof", tone: "blue", family: "style", tier: 1, description: "Log 5 overhang climbs." },
  { id: "roof_raider", name: "Roof Raider", icon: "roof", tone: "indigo", family: "style", tier: 1, description: "Log 8 roof or overhang climbs." },
  { id: "crimp_cadet", name: "Crimp Cadet", icon: "diamond", tone: "silver", family: "style", tier: 1, description: "Log 5 crimpy climbs." },
  { id: "crimp_crafter", name: "Crimp Crafter", icon: "diamond", tone: "cyan", family: "style", tier: 1, description: "Log 10 crimpy climbs." },
  { id: "sloper_surfer", name: "Sloper Surfer", icon: "ring", tone: "teal", family: "style", tier: 1, description: "Log 8 sloper climbs." },
  { id: "pinch_press", name: "Pinch Press", icon: "diamond", tone: "orange", family: "style", tier: 1, description: "Log 8 pinchy climbs." },
  { id: "jug_journey", name: "Jug Journey", icon: "ring", tone: "lime", family: "style", tier: 1, description: "Log 8 juggy climbs." },
  { id: "pocket_ace", name: "Pocket Ace", icon: "ring", tone: "silver", family: "style", tier: 1, description: "Log 8 pocket climbs." },
  { id: "undercling_engine", name: "Undercling Engine", icon: "arrow-up", tone: "blue", family: "style", tier: 1, description: "Log 8 undercling climbs." },
  { id: "dynamic_start", name: "Dynamic Start", icon: "comet", tone: "orange", family: "movement", tier: 1, description: "Log 4 dynamic climbs." },
  { id: "dynamic_driver", name: "Dynamic Driver", icon: "comet", tone: "red", family: "movement", tier: 1, description: "Log 8 dynamic climbs." },
  { id: "static_start", name: "Static Start", icon: "plus", tone: "mint", family: "movement", tier: 1, description: "Log 4 static climbs." },
  { id: "static_control", name: "Static Control", icon: "plus", tone: "mint", family: "movement", tier: 1, description: "Log 8 static climbs." },
  { id: "balance_keeper", name: "Balance Keeper", icon: "compass", tone: "teal", family: "movement", tier: 1, description: "Log 8 balancey climbs." },
  { id: "tech_reader", name: "Tech Reader", icon: "compass", tone: "indigo", family: "movement", tier: 1, description: "Log 8 technical climbs." },
  { id: "power_driver", name: "Power Driver", icon: "comet", tone: "red", family: "movement", tier: 1, description: "Log 8 powerful climbs." },
  { id: "compression_lock", name: "Compression Lock", icon: "plus", tone: "violet", family: "movement", tier: 1, description: "Log 8 compression climbs." },
  { id: "flash_machine", name: "Flash Machine", icon: "bolt", tone: "lime", family: "flash", tier: 2, description: "Flash 10 climbs." },
  { id: "flash_streak", name: "Flash Streak", icon: "spark", tone: "gold", family: "flash", tier: 3, description: "Flash 20 climbs." },
  { id: "photo_memory", name: "Photo Memory", icon: "spark", tone: "silver", family: "milestone", tier: 1, description: "Log 10 climbs with photos." },
  { id: "journal_keeper", name: "Journal Keeper", icon: "flag", tone: "blue", family: "milestone", tier: 1, description: "Log notes on 15 climbs." },
  { id: "rainbow_run", name: "Rainbow Run", icon: "spark", tone: "sunset", family: "color", tier: 1, description: "Log 5 different climb colors." },
  { id: "palette_master", name: "Palette Master", icon: "spark", tone: "pink", family: "color", tier: 2, description: "Log 8 different climb colors." },
  { id: "showing_up", name: "Showing Up", icon: "calendar", tone: "silver", family: "consistency", tier: 1, description: "Climb on 5 different days in the last 30 days." },
  { id: "show_up", name: "Show Up", icon: "calendar", tone: "silver", family: "consistency", tier: 1, description: "Climb on 8 different days in the last 30 days." },
  { id: "steady_engine", name: "Steady Engine", icon: "calendar", tone: "cyan", family: "consistency", tier: 2, description: "Climb on 12 different days in the last 30 days." },
  { id: "weekly_warmer", name: "Weekly Warmer", icon: "calendar", tone: "mint", family: "consistency", tier: 1, description: "Stay active in 3 calendar weeks in the selected history." },
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
  const recentActiveWeeks = countRecentActiveWeeks(completedClimbs, 30);
  const overhangAndRoofCount = completedClimbs.filter((climb) => climb.style_tags.includes("roof") || climb.style_tags.includes("overhang")).length;
  const personalBestRank = gradeRank(extractBaseGrade(stats.personalBest));
  const photoCount = completedClimbs.filter((climb) => Boolean(climb.photo_url)).length;
  const notesCount = completedClimbs.filter((climb) => Boolean(climb.notes?.trim())).length;

  const unlocked = new Set<EmblemId>();

  if (completedClimbs.length >= 1) unlocked.add("first_send");
  if (recentActiveDays >= 3) unlocked.add("first_week");
  if (flashedCount >= 1) unlocked.add("flash_start");
  if (flashedCount >= 5) unlocked.add("flash_five");
  if (completedClimbs.length >= 25) unlocked.add("volume_25");
  if (completedClimbs.length >= 100) unlocked.add("volume_100");
  if (completedClimbs.length >= 250) unlocked.add("volume_250");
  if (completedClimbs.length >= 500) unlocked.add("volume_500");
  if (personalBestRank >= gradeRank("V1")) unlocked.add("v1_breaker");
  if (personalBestRank >= gradeRank("V2")) unlocked.add("v2_breaker");
  if (personalBestRank >= gradeRank("V3")) unlocked.add("v3_breaker");
  if (personalBestRank >= gradeRank("V4")) unlocked.add("v4_chaser");
  if (personalBestRank >= gradeRank("V5")) unlocked.add("v5_hunter");
  if (personalBestRank >= gradeRank("V6")) unlocked.add("v6_hunter");
  if (personalBestRank >= gradeRank("V7")) unlocked.add("v7_legend");
  if (personalBestRank >= gradeRank("V8")) unlocked.add("v8_orbit");
  if (stats.level >= 5) unlocked.add("level_5");
  if (stats.level >= 10) unlocked.add("level_10");
  if (stats.level >= 20) unlocked.add("level_20");
  if (stats.level >= 30) unlocked.add("level_30");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("slab")).length >= 5) unlocked.add("slab_sampler");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("slab")).length >= 10) unlocked.add("slab_sage");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("overhang")).length >= 5) unlocked.add("overhang_operator");
  if (overhangAndRoofCount >= 8) unlocked.add("roof_raider");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("crimpy")).length >= 5) unlocked.add("crimp_cadet");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("crimpy")).length >= 10) unlocked.add("crimp_crafter");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("sloper")).length >= 8) unlocked.add("sloper_surfer");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("pinchy")).length >= 8) unlocked.add("pinch_press");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("juggy")).length >= 8) unlocked.add("jug_journey");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("pockets")).length >= 8) unlocked.add("pocket_ace");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("undercling")).length >= 8) unlocked.add("undercling_engine");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("dynamic")).length >= 4) unlocked.add("dynamic_start");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("dynamic")).length >= 8) unlocked.add("dynamic_driver");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("static")).length >= 4) unlocked.add("static_start");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("static")).length >= 8) unlocked.add("static_control");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("balancey")).length >= 8) unlocked.add("balance_keeper");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("technical")).length >= 8) unlocked.add("tech_reader");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("powerful")).length >= 8) unlocked.add("power_driver");
  if (completedClimbs.filter((climb) => climb.style_tags.includes("compression")).length >= 8) unlocked.add("compression_lock");
  if (flashedCount >= 10) unlocked.add("flash_machine");
  if (flashedCount >= 20) unlocked.add("flash_streak");
  if (photoCount >= 10) unlocked.add("photo_memory");
  if (notesCount >= 15) unlocked.add("journal_keeper");
  if (colorCount >= 5) unlocked.add("rainbow_run");
  if (colorCount >= 8) unlocked.add("palette_master");
  if (recentActiveDays >= 5) unlocked.add("showing_up");
  if (recentActiveDays >= 8) unlocked.add("show_up");
  if (recentActiveDays >= 12) unlocked.add("steady_engine");
  if (recentActiveWeeks >= 3) unlocked.add("weekly_warmer");
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

function countRecentActiveWeeks(climbs: ClimbRow[], days: number) {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (days - 1));

  return new Set(
    climbs
      .filter((climb) => new Date(`${climb.climbed_on}T00:00:00`) >= threshold)
      .map((climb) => {
        const date = new Date(`${climb.climbed_on}T00:00:00`);
        const day = date.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + mondayOffset);
        return date.toISOString().slice(0, 10);
      })
  ).size;
}

function extractBaseGrade(personalBest: string) {
  const match = personalBest.match(/VB|V10|V[0-9]/);
  return (match?.[0] ?? "VB") as "VB" | "V0" | "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10";
}

function gradeRank(grade: "VB" | "V0" | "V1" | "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10") {
  return ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"].indexOf(grade);
}
