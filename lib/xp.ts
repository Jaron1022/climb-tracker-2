import type { ClimbForm, Grade, StyleTag } from "./types";

export const CLIMB_GRADES = [
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
  "crimpy",
  "sloper",
  "juggy",
  "dynamic",
  "technical",
  "powerful",
  "pinchy"
] as const;

export const DEFAULT_FORM: ClimbForm = {
  grade: "V0" as Grade,
  styleTags: ["vertical"] as StyleTag[],
  description: "",
  notes: "",
  status: "attempted",
  date: new Date().toISOString().slice(0, 10)
};

const XP_BY_GRADE: Record<Grade, number> = {
  V0: 20,
  V1: 30,
  V2: 45,
  V3: 60,
  V4: 80,
  V5: 105,
  V6: 135,
  V7: 170,
  V8: 210,
  V9: 255,
  V10: 305
};

export function gradeToXp(grade: Grade) {
  return XP_BY_GRADE[grade];
}

export function levelFromXp(xp: number) {
  return Math.floor(xp / 120) + 1;
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

  return "Start with a few completed V0s and the app will suggest the next step.";
}
