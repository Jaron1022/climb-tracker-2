import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  FriendFeedClimb,
  FriendshipRow,
  FriendSummary,
  IncomingFriendRequest,
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
    .select("id, display_name, created_at")
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
  const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", requesterIds);

  if (error) {
    throw error;
  }

  const names = new Map<string, string>((data ?? []).map((profile: any) => [profile.id, profile.display_name]));

  return pendingIncoming.map((item) => ({
    friendshipId: item.id,
    requesterId: item.requester_id,
    requesterName: names.get(item.requester_id) ?? "Climber",
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
  const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", friendIds);

  if (error) {
    throw error;
  }

  const names = new Map<string, string>((data ?? []).map((profile: any) => [profile.id, profile.display_name]));

  return accepted
    .map((item) => {
      const friendId = item.requester_id === userId ? item.addressee_id : item.requester_id;

      return {
        friendshipId: item.id,
        friendId,
        friendName: names.get(friendId) ?? "Climber",
        createdAt: item.responded_at ?? item.created_at
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

export async function createDemoFriend() {
  const supabase = getSupabaseBrowserClient() as any;
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error(sessionError?.message || "Auth session missing.");
  }

  const response = await fetch("/api/demo-friend", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; demoName?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Could not create the demo friend.");
  }

  return payload.demoName ?? "Demo Crusher";
}
