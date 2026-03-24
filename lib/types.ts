import type { CLIMB_GRADES, STYLE_TAGS } from "./xp";

export type Grade = (typeof CLIMB_GRADES)[number];
export type StyleTag = (typeof STYLE_TAGS)[number];
export type ClimbStatus = "attempted" | "completed";
export type GradeModifier = "-" | "+" | null;

export type ProfileRow = {
  id: string;
  display_name: string;
  device_id: string;
  created_at: string;
};

export type ClimbRow = {
  id: string;
  profile_id: string;
  photo_url: string | null;
  grade: Grade;
  flashed?: boolean;
  grade_modifier?: GradeModifier;
  style_tags: StyleTag[];
  wall_name: string | null;
  notes: string | null;
  status: ClimbStatus;
  climbed_on: string;
  created_at: string;
};

export type ClimbInsert = {
  profile_id: string;
  photo_url: string | null;
  grade: Grade;
  flashed?: boolean;
  grade_modifier?: GradeModifier;
  style_tags: StyleTag[];
  wall_name: string | null;
  notes: string | null;
  status: ClimbStatus;
  climbed_on: string;
};

export type ClimbForm = {
  grade: Grade;
  flashed: boolean;
  gradeModifier: GradeModifier;
  styleTags: StyleTag[];
  description: string;
  notes: string;
  date: string;
};
