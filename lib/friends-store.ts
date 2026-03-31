import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildStats } from "@/lib/stats";
import { CLIMB_GRADES, climbToXp, levelFromXp } from "@/lib/xp";
import type {
  ClimbRow,
  FriendFeedClimb,
  FriendshipRow,
  FriendSummary,
  IncomingFriendRequest,
  Grade,
  ProfileSearchRow
} from "@/lib/types";

export async function searchProfiles(query: string, currentUserId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const trimmed = query.trim();

  if (!trimmed) {
    return [] as ProfileSearchRow[];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", currentUserId)
    .ilike("display_name", `%${trimmed}%`)
    .order("display_name", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileSearchRow[];
}

export async function fetchFriendshipsForUser(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as FriendshipRow[];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.from("friendships").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "pending"
  });

  if (error) {
    throw error;
  }
}

export async function respondToFriendRequest(friendshipId: string, status: "accepted" | "declined") {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase
    .from("friendships")
    .update({
      status,
      responded_at: new Date().toISOString()
    })
    .eq("id", friendshipId);

  if (error) {
    throw error;
  }
}

export async function removeFriendship(friendshipId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

  if (error) {
    throw error;
  }
}

export async function fetchIncomingRequests(userId: string) {
  const friendships = await fetchFriendshipsForUser(userId);
  const pendingIncoming = friendships.filter((item) => item.addressee_id === userId && item.status === "pending");

  if (pendingIncoming.length === 0) {
    return [] as IncomingFriendRequest[];
  }

  const supabase = getSupabaseBrowserClient() as any;
  const requesterIds = pendingIncoming.map((item) => item.requester_id);
  const { data, error } = await supabase.from("profiles").select("*").in("id", requesterIds);

  if (error) {
    throw error;
  }

  const profiles = new Map<string, any>((data ?? []).map((profile: any) => [profile.id, profile]));

  return pendingIncoming.map((item) => ({
    friendshipId: item.id,
    requesterId: item.requester_id,
    requesterName: profiles.get(item.requester_id)?.display_name ?? "Climber",
    requesterAvatarUrl: profiles.get(item.requester_id)?.avatar_url ?? null,
    requesterSelectedEmblems: profiles.get(item.requester_id)?.selected_emblems ?? [],
    requesterSelectedAvatarBorder: profiles.get(item.requester_id)?.selected_avatar_border ?? null,
    createdAt: item.created_at
  }));
}

export async function fetchFriends(userId: string) {
  const friendships = await fetchFriendshipsForUser(userId);
  const accepted = friendships.filter((item) => item.status === "accepted");

  if (accepted.length === 0) {
    return [] as FriendSummary[];
  }

  const friendIds = accepted.map((item) => (item.requester_id === userId ? item.addressee_id : item.requester_id));
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.from("profiles").select("*").in("id", friendIds);

  if (error) {
    throw error;
  }

  const profilesById = new Map<string, { display_name: string; avatar_url: string | null; selected_emblems: string[]; selected_avatar_border: string | null }>(
    (data ?? []).map((profile: any) => [
      profile.id,
      {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url ?? null,
        selected_emblems: profile.selected_emblems ?? [],
        selected_avatar_border: profile.selected_avatar_border ?? null
      }
    ])
  );
  const { data: climbData, error: climbError } = await supabase.from("climbs").select("*").in("profile_id", friendIds);

  if (climbError) {
    throw climbError;
  }

  const climbsByFriend = new Map<string, ClimbRow[]>();
  ((climbData ?? []) as ClimbRow[]).forEach((climb) => {
    const current = climbsByFriend.get(climb.profile_id) ?? [];
    current.push(climb);
    climbsByFriend.set(climb.profile_id, current);
  });

  return accepted
    .map((item) => {
      const friendId = item.requester_id === userId ? item.addressee_id : item.requester_id;
      const friendClimbs = climbsByFriend.get(friendId) ?? [];
      const recentClimbs = getRecentClimbs(friendClimbs, 7);
      const friendXp = (climbsByFriend.get(friendId) ?? []).reduce(
        (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
        0
      );
      const friendStats = buildStats(friendClimbs);
      const recentStats = buildStats(recentClimbs);
      const friendProfile = profilesById.get(friendId);

      const leaderboardBreakdown = getLeaderboardScoreBreakdown(
        recentStats.personalBest as Grade,
        recentClimbs.length,
        new Set(recentClimbs.map((climb) => climb.climbed_on)).size
      );

      return {
        friendshipId: item.id,
        friendId,
        friendName: friendProfile?.display_name ?? "Climber",
        avatarUrl: friendProfile?.avatar_url ?? null,
        selectedEmblems: friendProfile?.selected_emblems ?? [],
        selectedAvatarBorder: friendProfile?.selected_avatar_border ?? null,
        createdAt: item.responded_at ?? item.created_at,
        level: levelFromXp(friendXp),
        totalSends: friendClimbs.length,
        personalBest: friendStats.personalBest as Grade,
        hardestSend7: recentStats.personalBest as Grade,
        recentSends7: recentClimbs.length,
        activeDays7: new Set(recentClimbs.map((climb) => climb.climbed_on)).size,
        leaderboardScore: sumLeaderboardScoreBreakdown(leaderboardBreakdown),
        leaderboardBreakdown
      };
    })
    .sort((left, right) => left.friendName.localeCompare(right.friendName));
}

export async function fetchFriendFeed(userId: string) {
  const friends = await fetchFriends(userId);

  if (friends.length === 0) {
    return [] as FriendFeedClimb[];
  }

  const supabase = getSupabaseBrowserClient() as any;
  const friendIds = friends.map((friend) => friend.friendId);
  const nameMap = new Map<string, string>(friends.map((friend) => [friend.friendId, friend.friendName]));
  const { data, error } = await supabase
    .from("climbs")
    .select("*")
    .in("profile_id", friendIds)
    .order("climbed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as any[]).map((climb) => ({
    ...climb,
    friend_name: nameMap.get(climb.profile_id) ?? "Climber"
  })) as FriendFeedClimb[];
}

export function buildLeaderboardScore(hardestSend7: Grade, recentSends7: number, activeDays7: number) {
  return sumLeaderboardScoreBreakdown(getLeaderboardScoreBreakdown(hardestSend7, recentSends7, activeDays7));
}

export function getLeaderboardScoreBreakdown(hardestSend7: Grade, recentSends7: number, activeDays7: number) {
  const normalizedGrade = normalizeLeaderboardGrade(hardestSend7);
  const gradeIndex = Math.max(0, CLIMB_GRADES.indexOf(normalizedGrade));
  const cappedRecentSends = Math.max(0, recentSends7);
  const cappedActiveDays = Math.min(Math.max(0, activeDays7), 4);
  return {
    hardestSendPoints: getWeeklyHardestSendBonus(gradeIndex),
    recentSendsPoints: cappedRecentSends * 10,
    activeDaysPoints: cappedActiveDays * 15
  };
}

function sumLeaderboardScoreBreakdown(breakdown: {
  hardestSendPoints: number;
  recentSendsPoints: number;
  activeDaysPoints: number;
}) {
  return breakdown.hardestSendPoints + breakdown.recentSendsPoints + breakdown.activeDaysPoints;
}

function getRecentClimbs(climbs: ClimbRow[], days: number) {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - (days - 1));

  return climbs.filter((climb) => {
    const climbedOn = new Date(`${climb.climbed_on}T00:00:00`);
    return climbedOn >= threshold;
  });
}

function normalizeLeaderboardGrade(personalBest: Grade) {
  return (personalBest.match(/^VB|^V\d+/)?.[0] ?? "VB") as Grade;
}

function getWeeklyHardestSendBonus(gradeIndex: number) {
  const bonuses = [0, 2, 5, 9, 14, 20, 28, 38, 50, 65, 83, 105];
  return bonuses[Math.min(Math.max(0, gradeIndex), bonuses.length - 1)] ?? 0;
}
