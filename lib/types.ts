import type { CLIMB_GRADES, STYLE_TAGS } from "./xp";

export type Grade = (typeof CLIMB_GRADES)[number];
export type StyleTag = (typeof STYLE_TAGS)[number];
export type ClimbStatus = "attempted" | "completed";
export type GradeModifier = "-" | "+" | null;

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  selected_emblems: string[];
  selected_avatar_border: string | null;
  selected_theme: string | null;
  device_id: string;
  created_at: string;
};

export type ProfileSearchRow = Pick<ProfileRow, "id" | "display_name" | "avatar_url" | "selected_emblems" | "selected_avatar_border" | "created_at">;

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

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type IncomingFriendRequest = {
  friendshipId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string | null;
  requesterSelectedEmblems: string[];
  requesterSelectedAvatarBorder: string | null;
  createdAt: string;
};

export type FriendSummary = {
  friendshipId: string;
  friendId: string;
  friendName: string;
  avatarUrl: string | null;
  selectedEmblems: string[];
  selectedAvatarBorder: string | null;
  createdAt: string;
  level: number;
  totalSends: number;
  personalBest: Grade;
  hardestSend7: Grade;
  recentSends7: number;
  activeDays7: number;
  leaderboardScore: number;
  leaderboardBreakdown: {
    hardestSendPoints: number;
    recentSendsPoints: number;
    activeDaysPoints: number;
  };
};

export type FriendFeedClimb = ClimbRow & {
  friend_name: string;
};

export type ClimbForm = {
  grade: Grade;
  flashed: boolean;
  gradeModifier: GradeModifier;
  styleTags: StyleTag[];
  color: string;
  notes: string;
  date: string;
};
