import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClimbInsert, ClimbRow, ProfileRow } from "@/lib/types";

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient() as any;
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const supabase = getSupabaseBrowserClient() as any;
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  const displayName = data.user.user_metadata.display_name;
  if (typeof displayName === "string" && displayName.trim()) {
    await ensureProfile(data.user.id, displayName);
  }

  return data.user;
}

export async function signOutUser() {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function fetchProfile(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}

export async function ensureProfile(userId: string, displayName: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: displayName,
        device_id: "supabase-account"
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function updateDisplayName(userId: string, displayName: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: displayName
    }
  });

  if (error) {
    throw error;
  }

  return ensureProfile(userId, displayName);
}

export async function fetchClimbsForUser(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("climbs")
    .select("*")
    .eq("profile_id", userId)
    .order("climbed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ClimbRow[];
}

export async function saveClimbForUser(userId: string, payload: Omit<ClimbInsert, "profile_id">) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.from("climbs").insert({
    ...payload,
    profile_id: userId
  });

  if (error) {
    throw error;
  }
}

export async function updateClimbForUser(userId: string, climbId: string, payload: Omit<ClimbInsert, "profile_id">) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data: existing, error: fetchError } = await supabase
    .from("climbs")
    .select("photo_url")
    .eq("id", climbId)
    .eq("profile_id", userId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (existing.photo_url && existing.photo_url !== payload.photo_url && shouldUseR2()) {
    await deletePhotoFromR2(existing.photo_url);
  }

  const { error } = await supabase
    .from("climbs")
    .update({
      ...payload,
      profile_id: userId
    })
    .eq("id", climbId)
    .eq("profile_id", userId);

  if (error) {
    throw error;
  }
}

export async function deleteClimbForUser(userId: string, climbId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data: existing, error: fetchError } = await supabase
    .from("climbs")
    .select("photo_url")
    .eq("id", climbId)
    .eq("profile_id", userId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (existing.photo_url && shouldUseR2()) {
    await deletePhotoFromR2(existing.photo_url);
  }

  const { error } = await supabase.from("climbs").delete().eq("id", climbId).eq("profile_id", userId);

  if (error) {
    throw error;
  }
}

export async function deleteCurrentAccount() {
  const supabase = getSupabaseBrowserClient() as any;
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error(sessionError?.message || "Auth session missing.");
  }

  const response = await fetch("/api/account-delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Account deletion failed.");
  }

  await signOutUser();
}

async function deletePhotoFromR2(photoUrl: string) {
  const response = await fetch("/api/photo-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ photoUrl })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Cloud photo delete failed.");
  }
}

function shouldUseR2() {
  return Boolean(typeof window !== "undefined" && process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
}
