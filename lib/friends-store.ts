import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildStats } from "@/lib/stats";
import { climbToXp, levelFromXp } from "@/lib/xp";
import type {
  ClimbRow,
  FriendFeedClimb,
  FriendshipRow,
  FriendSummary,
  IncomingFriendRequest,
  Grade,
  ProfileSearchRow,
  ReceivedKudosInboxItem,
  SessionNoteRow,
  SessionKudosRow,
  SessionKudosSummary
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
      const weeklyXp = recentClimbs.reduce(
        (total, climb) => total + climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null),
        0
      );
      const friendProfile = profilesById.get(friendId);

      const activeDays7 = new Set(recentClimbs.map((climb) => climb.climbed_on)).size;
      const uniqueGrades7 = new Set(recentClimbs.map((climb) => climb.grade)).size;
      const leaderboardBreakdown = getLeaderboardScoreBreakdown(weeklyXp, recentClimbs.length, activeDays7, uniqueGrades7);

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
        weeklyXp7: weeklyXp,
        recentSends7: recentClimbs.length,
        activeDays7,
        uniqueGrades7,
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

export async function fetchSessionKudos(userId: string, feed: FriendFeedClimb[]) {
  if (feed.length === 0) {
    return {} as Record<string, SessionKudosSummary>;
  }

  const supabase = getSupabaseBrowserClient() as any;
  const recipientIds = Array.from(new Set(feed.map((climb) => climb.profile_id)));
  const sessionIds = new Set(feed.map((climb) => `${climb.profile_id}:${climb.climbed_on}`));
  const climbedOnValues = Array.from(new Set(feed.map((climb) => climb.climbed_on))).sort();
  const earliestDate = climbedOnValues[0];
  const latestDate = climbedOnValues[climbedOnValues.length - 1];

  const { data, error } = await supabase
    .from("session_kudos")
    .select("*")
    .in("recipient_id", recipientIds)
    .gte("climbed_on", earliestDate)
    .lte("climbed_on", latestDate);

  if (error) {
    throw error;
  }

  const summaries: Record<string, SessionKudosSummary> = {};
  ((data ?? []) as SessionKudosRow[]).forEach((row) => {
    const sessionId = `${row.recipient_id}:${row.climbed_on}`;
    if (!sessionIds.has(sessionId)) {
      return;
    }

    const current = summaries[sessionId] ?? { count: 0, likedByViewer: false };
    current.count += 1;
    if (row.sender_id === userId) {
      current.likedByViewer = true;
    }
    summaries[sessionId] = current;
  });

  return summaries;
}

export async function toggleSessionKudos(userId: string, recipientId: string, climbedOn: string, shouldLike: boolean) {
  const supabase = getSupabaseBrowserClient() as any;

  if (shouldLike) {
    const { error } = await supabase.from("session_kudos").insert({
      sender_id: userId,
      recipient_id: recipientId,
      climbed_on: climbedOn
    });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("session_kudos")
    .delete()
    .eq("sender_id", userId)
    .eq("recipient_id", recipientId)
    .eq("climbed_on", climbedOn);

  if (error) {
    throw error;
  }
}

export async function fetchReceivedSessionKudos(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("session_kudos")
    .select("climbed_on")
    .eq("recipient_id", userId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ climbed_on: string }>).reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.climbed_on] = (accumulator[row.climbed_on] ?? 0) + 1;
    return accumulator;
  }, {});
}

export async function fetchReceivedKudosInbox(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("session_kudos")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw error;
  }

  const kudosRows = (data ?? []) as SessionKudosRow[];
  if (kudosRows.length === 0) {
    return [] as ReceivedKudosInboxItem[];
  }

  const senderIds = Array.from(new Set(kudosRows.map((row) => row.sender_id)));
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", senderIds);

  if (profileError) {
    throw profileError;
  }

  const profilesById = new Map<string, any>((profileData ?? []).map((profile: any) => [profile.id, profile]));

  return kudosRows.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: profilesById.get(row.sender_id)?.display_name ?? "Climber",
    senderAvatarUrl: profilesById.get(row.sender_id)?.avatar_url ?? null,
    senderSelectedEmblems: profilesById.get(row.sender_id)?.selected_emblems ?? [],
    climbedOn: row.climbed_on,
    createdAt: row.created_at
  }));
}

export async function fetchFriendSessionNotes(feed: FriendFeedClimb[]) {
  if (feed.length === 0) {
    return {} as Record<string, string>;
  }

  const supabase = getSupabaseBrowserClient() as any;
  const profileIds = Array.from(new Set(feed.map((climb) => climb.profile_id)));
  const sessionIds = new Set(feed.map((climb) => `${climb.profile_id}:${climb.climbed_on}`));
  const sessionDates = Array.from(new Set(feed.map((climb) => climb.climbed_on))).sort();
  const earliestDate = sessionDates[0];
  const latestDate = sessionDates[sessionDates.length - 1];

  const { data, error } = await supabase
    .from("session_notes")
    .select("*")
    .in("profile_id", profileIds)
    .gte("session_on", earliestDate)
    .lte("session_on", latestDate);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SessionNoteRow[]).reduce<Record<string, string>>((accumulator, row) => {
    const sessionId = `${row.profile_id}:${row.session_on}`;
    if (sessionIds.has(sessionId)) {
      accumulator[sessionId] = row.note;
    }
    return accumulator;
  }, {});
}

export function buildLeaderboardScore(weeklyXp7: number, recentSends7: number, activeDays7: number, uniqueGrades7: number) {
  return sumLeaderboardScoreBreakdown(getLeaderboardScoreBreakdown(weeklyXp7, recentSends7, activeDays7, uniqueGrades7));
}

export function getLeaderboardScoreBreakdown(weeklyXp7: number, recentSends7: number, activeDays7: number, uniqueGrades7: number) {
  const cappedActiveDays = Math.min(Math.max(0, activeDays7), 4);
  const cappedSends = Math.min(Math.max(0, recentSends7), 7);
  const cappedVariety = Math.min(Math.max(0, uniqueGrades7), 4);
  const compressedXp = weeklyXp7 <= 0 ? 0 : Math.min(45, Math.round(Math.log2(weeklyXp7 + 1) * 5));
  return {
    weeklyXpPoints: compressedXp,
    sendPoints: cappedSends * 5,
    activeDaysPoints: cappedActiveDays * 10,
    varietyPoints: cappedVariety * 5
  };
}

function sumLeaderboardScoreBreakdown(breakdown: {
  weeklyXpPoints: number;
  sendPoints: number;
  activeDaysPoints: number;
  varietyPoints: number;
}) {
  return breakdown.weeklyXpPoints + breakdown.sendPoints + breakdown.activeDaysPoints + breakdown.varietyPoints;
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
