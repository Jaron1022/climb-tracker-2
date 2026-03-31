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

  const profilesById = new Map<string, { display_name: string; avatar_url: string | null; selected_emblems: string[] }>(
    (data ?? []).map((profile: any) => [
      profile.id,
      {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url ?? null,
        selected_emblems: profile.selected_emblems ?? []
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
      const recentClimbs = getRecentClimbs(friendClimbs);
      const friendXp = (climbsByFriend.get(friendId) ?? []).reduce(
        (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
        0
      );
      const friendStats = buildStats(friendClimbs);
      const friendProfile = profilesById.get(friendId);

      return {
        friendshipId: item.id,
        friendId,
        friendName: friendProfile?.display_name ?? "Climber",
        avatarUrl: friendProfile?.avatar_url ?? null,
        selectedEmblems: friendProfile?.selected_emblems ?? [],
        createdAt: item.responded_at ?? item.created_at,
        level: levelFromXp(friendXp),
        totalSends: friendClimbs.length,
        personalBest: friendStats.personalBest as Grade,
        recentSends30: recentClimbs.length,
        activeDays30: new Set(recentClimbs.map((climb) => climb.climbed_on)).size,
        leaderboardScore: buildLeaderboardScore(
          levelFromXp(friendXp),
          friendStats.personalBest as Grade,
          recentClimbs.length,
          new Set(recentClimbs.map((climb) => climb.climbed_on)).size
        )
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

export function buildLeaderboardScore(level: number, personalBest: Grade, recentSends30: number, activeDays30: number) {
  const gradeIndex = Math.max(0, CLIMB_GRADES.indexOf(personalBest));
  const cappedRecentSends = Math.min(recentSends30, 12);
  const cappedActiveDays = Math.min(activeDays30, 8);
  return level * 100 + gradeIndex * 18 + cappedRecentSends * 6 + cappedActiveDays * 10;
}

function getRecentClimbs(climbs: ClimbRow[]) {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - 29);

  return climbs.filter((climb) => {
    const climbedOn = new Date(`${climb.climbed_on}T00:00:00`);
    return climbedOn >= threshold;
  });
}
