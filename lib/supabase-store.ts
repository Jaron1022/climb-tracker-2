import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClimbInsert, ClimbRow, ProfileRow, ProjectInsert, ProjectRow, SessionNoteRow } from "@/lib/types";

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

export function subscribeToAuthChanges(callback: (user: User | null, event?: string) => void) {
  const supabase = getSupabaseBrowserClient() as any;
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    callback(session?.user ?? null, _event);
  });

  return () => subscription.unsubscribe();
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    throw error;
  }

  const identityCount = Array.isArray(data.user?.identities) ? data.user.identities.length : 0;
  if (data.user && identityCount === 0) {
    throw new Error("This email already has an account. Sign in instead.");
  }

  return data.user;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });

  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    throw error;
  }
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

export async function updateProfileAvatar(userId: string, avatarUrl: string | null) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data: existing, error: fetchError } = await supabase.from("profiles").select("avatar_url").eq("id", userId).single();

  if (fetchError) {
    throw fetchError;
  }

  if (existing.avatar_url && existing.avatar_url !== avatarUrl && shouldUseR2()) {
    await deletePhotoFromR2(existing.avatar_url);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function updateSelectedEmblems(userId: string, selectedEmblems: string[]) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      selected_emblems: selectedEmblems
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function updateSelectedAvatarBorder(userId: string, selectedAvatarBorder: string | null) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      selected_avatar_border: selectedAvatarBorder
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function updateSelectedTheme(userId: string, selectedTheme: string | null) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      selected_theme: selectedTheme
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
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

export async function fetchProjectsForUser(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", userId)
    .order("last_worked_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProjectRow[];
}

export async function fetchSessionNotesForUser(userId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("session_notes")
    .select("*")
    .eq("profile_id", userId)
    .order("session_on", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SessionNoteRow[];
}

export async function saveSessionNoteForUser(userId: string, sessionOn: string, note: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const trimmed = note.trim();

  if (!trimmed) {
    const { error } = await supabase
      .from("session_notes")
      .delete()
      .eq("profile_id", userId)
      .eq("session_on", sessionOn);

    if (error) {
      throw error;
    }

    return null;
  }

  const { data, error } = await supabase
    .from("session_notes")
    .upsert(
      {
        profile_id: userId,
        session_on: sessionOn,
        note: trimmed,
        updated_at: new Date().toISOString()
      },
      { onConflict: "profile_id,session_on" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as SessionNoteRow;
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

export async function saveProjectForUser(userId: string, payload: Omit<ProjectInsert, "profile_id">) {
  const supabase = getSupabaseBrowserClient() as any;
  const { error } = await supabase.from("projects").insert({
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

export async function updateProjectSessionForUser(userId: string, projectId: string, lastWorkedOn: string, incrementSessionCount: boolean) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("session_count")
    .eq("id", projectId)
    .eq("profile_id", userId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const { error } = await supabase
    .from("projects")
    .update({
      last_worked_on: lastWorkedOn,
      session_count: incrementSessionCount ? (existing.session_count ?? 0) + 1 : existing.session_count
    })
    .eq("id", projectId)
    .eq("profile_id", userId);

  if (error) {
    throw error;
  }
}

export async function deleteProjectForUser(userId: string, projectId: string) {
  const supabase = getSupabaseBrowserClient() as any;
  const { data: existing, error: fetchError } = await supabase
    .from("projects")
    .select("photo_url")
    .eq("id", projectId)
    .eq("profile_id", userId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (existing.photo_url && shouldUseR2()) {
    await deletePhotoFromR2(existing.photo_url);
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("profile_id", userId);

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
