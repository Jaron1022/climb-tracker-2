import { createClient } from "@supabase/supabase-js";
import type { ClimbInsert, ClimbRow, ProfileRow } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseReady
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

function clientOrThrow() {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}

export async function fetchProfiles() {
  const client = clientOrThrow();
  const { data, error } = await client.from("profiles").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as ProfileRow[];
}

export async function createProfile(displayName: string) {
  const client = clientOrThrow();
  const { data, error } = await client
    .from("profiles")
    .insert({
      display_name: displayName
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function fetchClimbsForProfile(profileId: string) {
  const client = clientOrThrow();
  const { data, error } = await client
    .from("climbs")
    .select("*")
    .eq("profile_id", profileId)
    .order("climbed_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data as ClimbRow[];
}

export async function saveClimb(payload: ClimbInsert) {
  const client = clientOrThrow();
  const { error } = await client.from("climbs").insert(payload);

  if (error) {
    throw error;
  }
}

export async function uploadPhoto(file: File) {
  const client = clientOrThrow();
  const uploadFile = await compressImage(file);
  const safeName = `${makeUploadId()}-${uploadFile.name.replace(/\s+/g, "-")}`;
  const path = `climb-photos/${safeName}`;

  const { error } = await client.storage.from("climb-photos").upload(path, uploadFile, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from("climb-photos").getPublicUrl(path);
  return data.publicUrl;
}

function makeUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function compressImage(file: File) {
  if (typeof window === "undefined") {
    return file;
  }

  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.type === "image/gif" || file.size < 1_000_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.78);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const compressedName = file.name.replace(/\.[^.]+$/, "") || "climb-photo";
    return new File([blob], `${compressedName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}
