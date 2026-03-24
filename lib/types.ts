import type { CLIMB_GRADES, STYLE_TAGS } from "./xp";

export type Grade = (typeof CLIMB_GRADES)[number];
export type StyleTag = (typeof STYLE_TAGS)[number];
export type ClimbStatus = "attempted" | "completed";

export type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
};

export type ClimbRow = {
  id: string;
  profile_id: string;
  photo_url: string | null;
  grade: Grade;
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
  style_tags: StyleTag[];
  wall_name: string | null;
  notes: string | null;
  status: ClimbStatus;
  climbed_on: string;
};

export type ClimbForm = {
  grade: Grade;
  styleTags: StyleTag[];
  description: string;
  notes: string;
  status: ClimbStatus;
  date: string;
};
