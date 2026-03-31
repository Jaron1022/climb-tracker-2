import { CLIMB_GRADES, climbToXp, levelFromXp, xpIntoCurrentLevel, xpNeededForNextLevel } from "./xp";
import type { ClimbRow, Grade, GradeModifier, StyleTag } from "./types";

export const PROGRESS_RANGES = ["1W", "1M", "3M", "1Y", "ALL"] as const;

export type ProgressRange = (typeof PROGRESS_RANGES)[number];

type ProgressBucket = {
  key: string;
  label: string;
  shortLabel: string;
  climbCount: number;
  xp: number;
};

export function buildStats(climbs: ClimbRow[]) {
  const completedClimbs = climbs.filter((climb) => climb.status === "completed");
  const xp = completedClimbs.reduce(
    (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
    0
  );
  const level = levelFromXp(xp);
  const xpThisLevel = xpIntoCurrentLevel(xp);
  const xpNextLevel = xpNeededForNextLevel(level);

  const completedByGrade = CLIMB_GRADES.reduce(
    (accumulator, grade) => {
      accumulator[grade] = completedClimbs.filter((climb) => climb.grade === grade).length;
      return accumulator;
    },
    {} as Record<Grade, number>
  );

  const tagCounts = countTags(climbs);
  const favoriteStyles = Object.entries(tagCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const personalBestClimb =
    completedClimbs
      .slice()
      .sort((left, right) => compareClimbsForBest(right, left))[0] ?? null;

  return {
    totalClimbs: climbs.length,
    totalCompleted: completedClimbs.length,
    completedByGrade,
    favoriteStyles,
    favoriteStylesText: favoriteStyles.length > 0 ? favoriteStyles.join(", ") : "Still learning",
    personalBest: personalBestClimb ? formatPersonalBest(personalBestClimb) : "No sends yet",
    xp,
    level,
    xpThisLevel,
    xpNextLevel,
    xpProgressPercent: Math.min((xpThisLevel / xpNextLevel) * 100, 100)
  };
}

export function buildProgressStats(climbs: ClimbRow[], range: ProgressRange) {
  const completedClimbs = climbs.filter((climb) => climb.status === "completed");
  const filteredClimbs = filterClimbsByRange(completedClimbs, range);
  const buckets = buildProgressBuckets(filteredClimbs, range);
  const dailyRecap = buildDailyRecap(completedClimbs);
  const activeWeeks = countUniqueWeeks(filteredClimbs);
  const totalWeeks = countCalendarWeeksInRange(range, filteredClimbs);
  const flashedClimbs = filteredClimbs.filter((climb) => climb.flashed);
  const flashCount = flashedClimbs.length;
  const totalXp = filteredClimbs.reduce(
    (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
    0
  );
  const topClimb =
    filteredClimbs
      .slice()
      .sort((left, right) => compareClimbsForBest(right, left))[0] ?? null;
  const tagCounts = countTags(filteredClimbs);
  const topStyles = Object.entries(tagCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([tag]) => tag);
  const completedByGrade = CLIMB_GRADES.reduce(
    (accumulator, grade) => {
      accumulator[grade] = filteredClimbs.filter((climb) => climb.grade === grade).length;
      return accumulator;
    },
    {} as Record<Grade, number>
  );
  const weeklyStreak = countWeeklyStreak(filteredClimbs);
  const averagePerActiveWeek = activeWeeks > 0 ? filteredClimbs.length / activeWeeks : 0;
  const consistencyPercent = Math.min((activeWeeks / totalWeeks) * 100, 100);
  const previousTotal = buckets.slice(0, Math.floor(buckets.length / 2)).reduce((sum, bucket) => sum + bucket.climbCount, 0);
  const recentTotal = buckets.slice(Math.floor(buckets.length / 2)).reduce((sum, bucket) => sum + bucket.climbCount, 0);
  const flashRateByGrade = CLIMB_GRADES.map((grade) => {
    const gradeClimbs = filteredClimbs.filter((climb) => climb.grade === grade);
    const flashedAtGrade = gradeClimbs.filter((climb) => climb.flashed).length;

    return {
      grade,
      climbCount: gradeClimbs.length,
      flashedCount: flashedAtGrade,
      flashRatePercent: gradeClimbs.length > 0 ? Math.round((flashedAtGrade / gradeClimbs.length) * 100) : null
    };
  });
  const averageFlashGrade = flashedClimbs.length > 0 ? formatAverageFlashGrade(flashedClimbs) : "No flashes yet";

  return {
    rangeLabel: rangeToLabel(range),
    cadenceLabel: cadenceLabelForRange(range),
    consistencyLabel: consistencyLabelForRange(range, totalWeeks),
    dailyRecap,
    filteredClimbs,
    sends: filteredClimbs.length,
    totalXp,
    activeWeeks,
    totalWeeks,
    weeklyStreak,
    consistencyPercent,
    flashRatePercent: filteredClimbs.length > 0 ? Math.round((flashCount / filteredClimbs.length) * 100) : 0,
    averageFlashGrade,
    flashRateByGrade,
    completedByGrade,
    averagePerActiveWeek,
    topGrade: topClimb ? formatPersonalBest(topClimb) : "No sends yet",
    topStyles,
    buckets,
    trendDirection: recentTotal > previousTotal ? "up" : recentTotal < previousTotal ? "down" : "steady"
  };
}

export function prettyDate(rawDate: string) {
  if (!rawDate) {
    return "Unknown date";
  }

  const normalized = rawDate.includes("T") ? rawDate : `${rawDate}T12:00:00`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function filterClimbsByRange(climbs: ClimbRow[], range: ProgressRange) {
  if (range === "ALL") {
    return climbs;
  }

  const now = startOfDay(new Date());
  const start = startOfDay(new Date(now));

  if (range === "1W") {
    start.setDate(now.getDate() - 6);
  } else if (range === "1M") {
    start.setDate(now.getDate() - 29);
  } else if (range === "3M") {
    start.setDate(now.getDate() - 89);
  } else if (range === "1Y") {
    start.setFullYear(now.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  }

  return climbs.filter((climb) => climbDate(climb) >= start);
}

function buildProgressBuckets(climbs: ClimbRow[], range: ProgressRange) {
  const now = startOfDay(new Date());

  if (range === "1W") {
    return buildDailyBuckets(climbs, now, 7, "week");
  }

  if (range === "1M") {
    return buildDailyBuckets(climbs, now, 30, "month");
  }

  if (range === "3M") {
    return buildWeeklyBuckets(climbs, now, 13, "quarter");
  }

  if (range === "1Y") {
    return buildMonthlyBuckets(climbs, now, 12);
  }

  const monthSpan = Math.max(1, Math.min(12, countMonthsBetween(climbs)));
  return buildMonthlyBuckets(climbs, now, monthSpan, range === "ALL");
}

function buildDailyBuckets(climbs: ClimbRow[], now: Date, count: number, labelMode: "week" | "month"): ProgressBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const date = startOfDay(new Date(now));
    date.setDate(now.getDate() - (count - index - 1));
    const key = date.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
    const shortLabel =
      labelMode === "week"
        ? new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).slice(0, 1)
        : index === 0 || index === count - 1 || index % 7 === 0
          ? new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(date)
          : "";
    return buildBucketFromClimbs(climbs, key, label, shortLabel, (climb) => climb.climbed_on === key);
  });
}

function buildWeeklyBuckets(climbs: ClimbRow[], now: Date, count: number, labelMode: "default" | "quarter"): ProgressBucket[] {
  const currentWeekStart = startOfWeek(now);
  return Array.from({ length: count }, (_, index) => {
    const start = startOfWeek(new Date(currentWeekStart));
    start.setDate(currentWeekStart.getDate() - (count - index - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const key = start.toISOString().slice(0, 10);
    const label = `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end)}`;
    const shortLabel =
      labelMode === "quarter"
        ? index === 0 || index === count - 1 || index % 4 === 0
          ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)
          : ""
        : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
    return buildBucketFromClimbs(climbs, key, label, shortLabel, (climb) => {
      const date = climbDate(climb);
      return date >= start && date <= end;
    });
  });
}

function buildMonthlyBuckets(climbs: ClimbRow[], now: Date, count: number, sparseLabels = false): ProgressBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthStart);
    const shortLabel =
      sparseLabels && !(index === 0 || index === count - 1 || index % 3 === 0)
        ? ""
        : new Intl.DateTimeFormat("en-US", { month: "short" }).format(monthStart);
    return buildBucketFromClimbs(climbs, key, label, shortLabel, (climb) => {
      const climbDt = climbDate(climb);
      return climbDt >= monthStart && climbDt <= monthEnd;
    });
  });
}

function buildBucketFromClimbs(
  climbs: ClimbRow[],
  key: string,
  label: string,
  shortLabel: string,
  matchesBucket: (climb: ClimbRow) => boolean
) {
  const bucketClimbs = climbs.filter(matchesBucket);
  return {
    key,
    label,
    shortLabel,
    climbCount: bucketClimbs.length,
    xp: bucketClimbs.reduce(
      (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
      0
    )
  };
}

function countUniqueWeeks(climbs: ClimbRow[]) {
  return new Set(climbs.map((climb) => weekKey(climbDate(climb)))).size;
}

function countWeeklyStreak(climbs: ClimbRow[]) {
  const weekKeys = new Set(climbs.map((climb) => weekKey(climbDate(climb))));
  if (weekKeys.size === 0) {
    return 0;
  }

  let streak = 0;
  let cursor = startOfWeek(new Date());

  while (weekKeys.has(weekKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  return streak;
}

function countCalendarWeeksInRange(range: ProgressRange, climbs: ClimbRow[]) {
  if (range === "ALL") {
    if (climbs.length === 0) {
      return 1;
    }

    const oldest = climbDate(climbs[climbs.length - 1]);
    const newest = startOfDay(new Date());
    return countWeeksBetween(oldest, newest);
  }

  const now = startOfDay(new Date());
  const start = startOfDay(new Date(now));

  if (range === "1W") {
    start.setDate(now.getDate() - 6);
  } else if (range === "1M") {
    start.setDate(now.getDate() - 29);
  } else if (range === "3M") {
    start.setDate(now.getDate() - 89);
  } else if (range === "1Y") {
    start.setFullYear(now.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  }

  return countWeeksBetween(start, now);
}

function countWeeksBetween(start: Date, end: Date) {
  const startWeek = startOfWeek(start);
  const endWeek = startOfWeek(end);
  const diffMs = endWeek.getTime() - startWeek.getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function countMonthsBetween(climbs: ClimbRow[]) {
  if (climbs.length === 0) {
    return 1;
  }

  const oldest = climbDate(climbs[climbs.length - 1]);
  const newest = climbDate(climbs[0]);
  return (newest.getFullYear() - oldest.getFullYear()) * 12 + (newest.getMonth() - oldest.getMonth()) + 1;
}

function climbDate(climb: ClimbRow) {
  return startOfDay(new Date(`${climb.climbed_on}T12:00:00`));
}

function startOfDay(date: Date) {
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(date: Date) {
  const copy = startOfDay(new Date(date));
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function weekKey(date: Date) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function rangeToLabel(range: ProgressRange) {
  if (range === "1W") {
    return "Last week";
  }

  if (range === "1M") {
    return "Last month";
  }

  if (range === "3M") {
    return "Last 3 months";
  }

  if (range === "1Y") {
    return "Last year";
  }

  return "All time";
}

function cadenceLabelForRange(range: ProgressRange) {
  if (range === "1W") {
    return "Daily view";
  }

  if (range === "1M") {
    return "Daily view";
  }

  if (range === "3M") {
    return "Weekly view";
  }

  return "Monthly view";
}

function consistencyLabelForRange(range: ProgressRange, totalWeeks: number) {
  if (range === "1W") {
    return `Weeks with at least one climb in the last ${totalWeeks} week`;
  }

  if (range === "1M" || range === "3M") {
    return `Weeks with at least one climb in the last ${totalWeeks} weeks`;
  }

  if (range === "1Y") {
    return `Weeks with at least one climb in the last ${totalWeeks} weeks`;
  }

  return `Weeks with at least one climb since you started logging`;
}

function countTags(climbs: ClimbRow[]) {
  return climbs.reduce(
    (accumulator, climb) => {
      climb.style_tags.forEach((tag) => {
        accumulator[tag] = (accumulator[tag] ?? 0) + 1;
      });
      return accumulator;
    },
    {} as Record<StyleTag, number>
  );
}

function compareClimbsForBest(left: ClimbRow, right: ClimbRow) {
  const gradeDelta = CLIMB_GRADES.indexOf(left.grade) - CLIMB_GRADES.indexOf(right.grade);
  if (gradeDelta !== 0) {
    return gradeDelta;
  }

  const modifierDelta = modifierRank(left.grade_modifier ?? null) - modifierRank(right.grade_modifier ?? null);
  if (modifierDelta !== 0) {
    return modifierDelta;
  }

  return Number(Boolean(left.flashed)) - Number(Boolean(right.flashed));
}

function modifierRank(modifier: GradeModifier) {
  if (modifier === "+") {
    return 2;
  }

  if (modifier === null) {
    return 1;
  }

  return 0;
}

function formatPersonalBest(climb: ClimbRow) {
  const flashText = climb.flashed ? " flash" : "";
  return `${climb.grade}${climb.grade_modifier ?? ""}${flashText}`;
}

function buildDailyRecap(climbs: ClimbRow[]) {
  if (climbs.length === 0) {
    return null;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const mostRecentDate = climbs.reduce((latest, climb) => (climb.climbed_on > latest ? climb.climbed_on : latest), climbs[0].climbed_on);
  const dayClimbs = climbs
    .filter((climb) => climb.climbed_on === mostRecentDate)
    .slice()
    .sort((left, right) => compareClimbsForBest(right, left));

  const totalXp = dayClimbs.reduce(
    (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
    0
  );
  const flashedCount = dayClimbs.filter((climb) => climb.flashed).length;
  const topClimb = dayClimbs[0];
  const topStyle = mostCommonTag(dayClimbs);
  const groups = buildDailyRecapGroups(dayClimbs);
  const maxGroupCount = Math.max(1, ...groups.map((group) => group.count));

  return {
    climbedOn: mostRecentDate,
    isToday: mostRecentDate === todayKey,
    totalXp,
    sends: dayClimbs.length,
    flashedCount,
    topGrade: topClimb ? `${topClimb.grade}${topClimb.grade_modifier ?? ""}` : null,
    topStyle,
    headline: buildDailyRecapHeadline(dayClimbs.length, totalXp, flashedCount),
    subheadline: buildDailyRecapSubheadline(dayClimbs.length, topClimb ? `${topClimb.grade}${topClimb.grade_modifier ?? ""}` : null),
    groups: groups.map((group) => ({
      ...group,
      fillPercent: (group.count / maxGroupCount) * 100
    }))
  };
}

function buildDailyRecapGroups(climbs: ClimbRow[]) {
  const groups = new Map<string, { label: string; count: number; xp: number; flashedCount: number }>();

  climbs.forEach((climb) => {
    const label = climb.grade;
    const current = groups.get(label) ?? {
      label,
      count: 0,
      xp: 0,
      flashedCount: 0
    };

    current.count += 1;
    current.xp += climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null);
    current.flashedCount += Number(Boolean(climb.flashed));
    groups.set(label, current);
  });

  return Array.from(groups.values()).sort((left, right) => {
    const gradeOrder = compareGradeLabel(right.label, left.label);
    if (gradeOrder !== 0) {
      return gradeOrder;
    }

    return right.count - left.count;
  });
}

function compareGradeLabel(left: string, right: string) {
  const leftParsed = parseGradeLabel(left);
  const rightParsed = parseGradeLabel(right);
  const gradeDelta = CLIMB_GRADES.indexOf(leftParsed.grade) - CLIMB_GRADES.indexOf(rightParsed.grade);

  if (gradeDelta !== 0) {
    return gradeDelta;
  }

  return modifierRank(leftParsed.modifier) - modifierRank(rightParsed.modifier);
}

function parseGradeLabel(label: string) {
  if (label.endsWith("+")) {
    return {
      grade: label.slice(0, -1) as Grade,
      modifier: "+" as GradeModifier
    };
  }

  if (label.endsWith("-")) {
    return {
      grade: label.slice(0, -1) as Grade,
      modifier: "-" as GradeModifier
    };
  }

  return {
    grade: label as Grade,
    modifier: null as GradeModifier
  };
}

function buildDailyRecapHeadline(sends: number, totalXp: number, flashedCount: number) {
  if (flashedCount > 0 && sends > 1) {
    return "Strong session";
  }

  if (totalXp >= 150) {
    return "Big progress day";
  }

  if (sends >= 3) {
    return "Nice volume session";
  }

  if (sends >= 1) {
    return "You showed up and logged work";
  }

  return "Session recap";
}

function buildDailyRecapSubheadline(sends: number, topGrade: string | null) {
  if (topGrade && sends > 1) {
    return `${sends} sends on the board, led by ${topGrade}.`;
  }

  if (topGrade) {
    return `One meaningful send at ${topGrade}.`;
  }

  return "Every session you track makes the bigger picture clearer.";
}

function mostCommonTag(climbs: ClimbRow[]) {
  const counts = countTags(climbs);
  const topEntry = Object.entries(counts).sort((left, right) => right[1] - left[1])[0];
  return topEntry?.[0] ?? null;
}

function formatAverageFlashGrade(climbs: ClimbRow[]) {
  const averageScore =
    climbs.reduce((total, climb) => total + gradeScore(climb.grade, climb.grade_modifier ?? null), 0) / climbs.length;

  const baseIndex = Math.max(
    0,
    Math.min(CLIMB_GRADES.length - 1, Math.floor(averageScore))
  );
  const baseGrade = CLIMB_GRADES[baseIndex];
  const remainder = averageScore - baseIndex;

  if (remainder >= 0.67 && baseIndex < CLIMB_GRADES.length - 1) {
    return `${CLIMB_GRADES[baseIndex + 1]}-`;
  }

  if (remainder >= 0.33 && baseIndex < CLIMB_GRADES.length - 1) {
    return `${baseGrade}+`;
  }

  return baseGrade;
}

function gradeScore(grade: Grade, modifier: GradeModifier) {
  const baseIndex = CLIMB_GRADES.indexOf(grade);

  if (modifier === "+") {
    return baseIndex + 0.35;
  }

  if (modifier === "-") {
    return baseIndex - 0.35;
  }

  return baseIndex;
}
