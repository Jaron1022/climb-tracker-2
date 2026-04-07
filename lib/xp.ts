import type { ClimbForm, Grade, GradeModifier, StyleTag } from "./types";

export const CLIMB_GRADES = [
  "VB",
  "V0",
  "V1",
  "V2",
  "V3",
  "V4",
  "V5",
  "V6",
  "V7",
  "V8",
  "V9",
  "V10"
] as const;

export const STYLE_TAGS = [
  "slab",
  "vertical",
  "overhang",
  "roof",
  "dihedral",
  "arete",
  "crimpy",
  "sloper",
  "pinchy",
  "juggy",
  "pockets",
  "undercling",
  "static",
  "dynamic",
  "technical",
  "balancey",
  "compression",
  "powerful"
] as const;

export const CLIMB_COLORS = ["purple", "black", "white", "yellow", "red", "blue", "green", "pink", "orange"] as const;

export const STYLE_TAG_GROUPS = [
  {
    label: "Wall angle",
    tags: ["slab", "vertical", "overhang", "roof", "dihedral", "arete"] as const
  },
  {
    label: "Hold type",
    tags: ["crimpy", "sloper", "pinchy", "juggy", "pockets", "undercling"] as const
  },
  {
    label: "Movement",
    tags: ["static", "dynamic", "technical", "balancey", "compression", "powerful"] as const
  }
] as const;

export const DEFAULT_FORM: ClimbForm = {
  grade: "VB" as Grade,
  flashed: false,
  gradeModifier: null,
  styleTags: [] as StyleTag[],
  color: "",
  notes: "",
  date: new Date().toISOString().slice(0, 10)
};

const XP_BY_GRADE: Record<Grade, number> = {
  VB: 1,
  V0: 2,
  V1: 4,
  V2: 8,
  V3: 15,
  V4: 31,
  V5: 63,
  V6: 125,
  V7: 251,
  V8: 501,
  V9: 794,
  V10: 1000
};

export const GRADE_MODIFIER_MULTIPLIERS: Record<Exclude<GradeModifier, null>, number> = {
  "-": 0.85,
  "+": 1.15
};

export const FLASH_XP_MULTIPLIER = 1.35;

export function gradeToXp(grade: Grade) {
  return XP_BY_GRADE[grade];
}

export function climbToXp(grade: Grade, flashed = false, gradeModifier: GradeModifier = null) {
  let xp = gradeToXp(grade);

  if (gradeModifier === "-") {
    xp *= GRADE_MODIFIER_MULTIPLIERS["-"];
  } else if (gradeModifier === "+") {
    xp *= GRADE_MODIFIER_MULTIPLIERS["+"];
  }

  if (flashed) {
    xp *= FLASH_XP_MULTIPLIER;
  }

  return Math.round(xp);
}

export function levelFromXp(xp: number) {
  let level = 1;
  let remainingXp = Math.max(0, xp);

  while (remainingXp >= xpNeededForNextLevel(level)) {
    remainingXp -= xpNeededForNextLevel(level);
    level += 1;
  }

  return level;
}

export function xpIntoCurrentLevel(xp: number) {
  let remainingXp = Math.max(0, xp);
  let level = 1;

  while (remainingXp >= xpNeededForNextLevel(level)) {
    remainingXp -= xpNeededForNextLevel(level);
    level += 1;
  }

  return remainingXp;
}

export function xpNeededForNextLevel(level: number) {
  const levelIndex = Math.max(0, level - 1);
  return 24 + levelIndex * 9 + levelIndex * levelIndex * 3;
}

export function hasGraduatedGrade(completedByGrade: Record<Grade, number>, grade: Grade) {
  return (completedByGrade[grade] ?? 0) >= 3;
}

export function nextGradeRecommendation(completedByGrade: Record<Grade, number>) {
  for (let index = 0; index < CLIMB_GRADES.length; index += 1) {
    const grade = CLIMB_GRADES[index];
    const completions = completedByGrade[grade] ?? 0;

    if (completions >= 3) {
      const nextGrade = CLIMB_GRADES[index + 1];
      if (nextGrade) {
        return `You have ${completions} sends at ${grade}. Try more ${nextGrade}s next session.`;
      }

      return `You are already logging strong climbs. Keep refining ${grade}.`;
    }

    if (completions > 0) {
      return `Keep building ${grade}. ${Math.max(3 - completions, 0)} more sends unlocks a nudge upward.`;
    }
  }

  return "Start with a few completed VBs or V0s and the app will suggest the next step.";
}
