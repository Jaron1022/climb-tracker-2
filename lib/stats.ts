import { CLIMB_GRADES, gradeToXp, levelFromXp } from "./xp";
import type { ClimbRow, Grade, StyleTag } from "./types";

export function buildStats(climbs: ClimbRow[]) {
  const completedClimbs = climbs.filter((climb) => climb.status === "completed");
  const xp = completedClimbs.reduce((total, climb) => total + gradeToXp(climb.grade), 0);

  const completedByGrade = CLIMB_GRADES.reduce(
    (accumulator, grade) => {
      accumulator[grade] = completedClimbs.filter((climb) => climb.grade === grade).length;
      return accumulator;
    },
    {} as Record<Grade, number>
  );

  const tagCounts = climbs.reduce(
    (accumulator, climb) => {
      climb.style_tags.forEach((tag) => {
        accumulator[tag] = (accumulator[tag] ?? 0) + 1;
      });
      return accumulator;
    },
    {} as Record<StyleTag, number>
  );

  const favoriteStyles = Object.entries(tagCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return {
    totalClimbs: climbs.length,
    totalCompleted: completedClimbs.length,
    completedByGrade,
    favoriteStyles,
    favoriteStylesText: favoriteStyles.length > 0 ? favoriteStyles.join(", ") : "Still learning",
    xp,
    level: levelFromXp(xp)
  };
}

export function prettyDate(rawDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${rawDate}T12:00:00`));
}
