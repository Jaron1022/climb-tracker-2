import type { ClimbInsert, ClimbRow, ProfileRow } from "@/lib/types";

const DB_NAME = "climb-tracker-db";
const DB_VERSION = 1;
const PROFILE_STORE = "profiles";
const CLIMB_STORE = "climbs";

const LEGACY_PROFILES_KEY = "climb-tracker-profiles";
const LEGACY_CLIMBS_KEY = "climb-tracker-climbs";

export async function fetchProfiles() {
  const db = await openDb();
  await migrateLegacyLocalStorage(db);
  const profiles = await getAll<ProfileRow>(db, PROFILE_STORE);
  return profiles.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createProfile(displayName: string) {
  const db = await openDb();
  const profile: ProfileRow = {
    id: makeId(),
    display_name: displayName,
    device_id: "local-device",
    created_at: new Date().toISOString()
  };

  await putItem(db, PROFILE_STORE, profile);
  return profile;
}

export async function fetchClimbsForProfile(profileId: string) {
  const db = await openDb();
  await migrateLegacyLocalStorage(db);
  const climbs = await getAll<ClimbRow>(db, CLIMB_STORE);
  return climbs
    .filter((climb) => climb.profile_id === profileId)
    .sort((left, right) => {
      const dateCompare = right.climbed_on.localeCompare(left.climbed_on);
      return dateCompare !== 0 ? dateCompare : right.created_at.localeCompare(left.created_at);
    });
}

export async function saveClimb(payload: ClimbInsert) {
  const db = await openDb();
  const climb: ClimbRow = {
    id: makeId(),
    created_at: new Date().toISOString(),
    ...payload
  };

  await putItem(db, CLIMB_STORE, climb);
}

export async function updateClimb(climbId: string, payload: ClimbInsert) {
  const db = await openDb();
  const existing = await getItem<ClimbRow>(db, CLIMB_STORE, climbId);

  if (!existing) {
    throw new Error("Could not find that climb to update.");
  }

  if (existing.photo_url && payload.photo_url !== existing.photo_url && shouldUseR2()) {
    await deletePhotoFromR2(existing.photo_url);
  }

  const climb: ClimbRow = {
    ...existing,
    ...payload
  };

  await putItem(db, CLIMB_STORE, climb);
}

export async function deleteClimb(climbId: string) {
  const db = await openDb();
  const climb = await getItem<ClimbRow>(db, CLIMB_STORE, climbId);

  if (!climb) {
    return;
  }

  if (climb.photo_url && shouldUseR2()) {
    await deletePhotoFromR2(climb.photo_url);
  }

  await deleteItem(db, CLIMB_STORE, climbId);
}

export async function uploadPhoto(file: File) {
  const uploadFile = await compressImage(file);
  if (shouldUseR2()) {
    return uploadPhotoToR2(uploadFile);
  }

  return fileToDataUrl(uploadFile);
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error("Could not open local climb storage on this device."));
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(CLIMB_STORE)) {
        db.createObjectStore(CLIMB_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function getAll<T>(db: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Could not read ${storeName} from this device.`));
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
  });
}

function getItem<T>(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(new Error(`Could not read ${storeName} from this device.`));
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
  });
}

function putItem(db: IDBDatabase, storeName: string, value: unknown) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(new Error(`Could not save ${storeName} on this device.`));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Could not save ${storeName} on this device.`));
  });
}

function deleteItem(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(new Error(`Could not delete ${storeName} on this device.`));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`Could not delete ${storeName} on this device.`));
  });
}

async function migrateLegacyLocalStorage(db: IDBDatabase) {
  if (typeof window === "undefined") {
    return;
  }

  const legacyProfiles = readLegacyJson<ProfileRow[]>(LEGACY_PROFILES_KEY, []);
  const legacyClimbs = readLegacyJson<ClimbRow[]>(LEGACY_CLIMBS_KEY, []);

  if (legacyProfiles.length === 0 && legacyClimbs.length === 0) {
    return;
  }

  const existingProfiles = await getAll<ProfileRow>(db, PROFILE_STORE);
  const existingClimbs = await getAll<ClimbRow>(db, CLIMB_STORE);

  if (existingProfiles.length === 0) {
    for (const profile of legacyProfiles) {
      await putItem(db, PROFILE_STORE, profile);
    }
  }

  if (existingClimbs.length === 0) {
    for (const climb of legacyClimbs) {
      await putItem(db, CLIMB_STORE, climb);
    }
  }

  window.localStorage.removeItem(LEGACY_PROFILES_KEY);
  window.localStorage.removeItem(LEGACY_CLIMBS_KEY);
}

function readLegacyJson<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read photo on this device."));
    reader.readAsDataURL(file);
  });
}

async function uploadPhotoToR2(file: File) {
  let response: Response;

  try {
    response = await fetch("/api/photo-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "image/jpeg"
      })
    });
  } catch {
    throw new Error("Could not reach the local upload route. Restart the app and try again.");
  }

  const payload = (await response.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    error?: string;
  };

  if (!response.ok || !payload.uploadUrl || !payload.publicUrl) {
    throw new Error(payload.error || "Could not prepare cloud photo upload.");
  }

  let uploadResponse: Response;

  try {
    uploadResponse = await fetch(payload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "image/jpeg"
      },
      body: file
    });
  } catch {
    throw new Error("Cloud photo upload was blocked. This is usually an R2 CORS or network issue.");
  }

  if (!uploadResponse.ok) {
    throw new Error(`Photo upload to cloud storage failed with status ${uploadResponse.status}.`);
  }

  return payload.publicUrl;
}

async function deletePhotoFromR2(photoUrl: string) {
  let response: Response;

  try {
    response = await fetch("/api/photo-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ photoUrl })
    });
  } catch {
    throw new Error("Could not reach the local delete route for the cloud photo.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Cloud photo delete failed.");
  }
}

function shouldUseR2() {
  return Boolean(typeof window !== "undefined" && window.location && process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
}

async function compressImage(file: File) {
  if (typeof window === "undefined") {
    return file;
  }

  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.type === "image/gif" || file.size < 600_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1200;
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
      canvas.toBlob(resolve, "image/jpeg", 0.68);
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
