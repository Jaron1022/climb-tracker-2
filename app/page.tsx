"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CLIMB_GRADES,
  DEFAULT_FORM,
  STYLE_TAGS,
  gradeToXp,
  hasGraduatedGrade,
  nextGradeRecommendation
} from "@/lib/xp";
import {
  createProfile,
  fetchClimbsForProfile,
  fetchProfiles,
  supabaseReady,
  uploadPhoto,
  saveClimb
} from "@/lib/supabase/client";
import type { ClimbInsert, ClimbRow, ProfileRow, StyleTag } from "@/lib/types";
import { buildStats, prettyDate } from "@/lib/stats";

export default function HomePage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [climbs, setClimbs] = useState<ClimbRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeAction, setActiveAction] = useState<"profile" | "climb" | "switch" | "load" | "">("");

  useEffect(() => {
    const savedProfileId = window.localStorage.getItem("climb-active-profile-id") ?? "";
    void initialize(savedProfileId);
  }, []);

  async function initialize(savedProfileId?: string) {
    try {
      setBooting(true);
      setActiveAction("load");
      setError("");

      if (!supabaseReady) {
        return;
      }

      const allProfiles = await fetchProfiles();
      setProfiles(allProfiles);

      const fallbackId = savedProfileId || allProfiles[0]?.id || "";
      if (fallbackId) {
        setActiveProfileId(fallbackId);
        window.localStorage.setItem("climb-active-profile-id", fallbackId);
        const profileClimbs = await fetchClimbsForProfile(fallbackId);
        setClimbs(profileClimbs);
      }
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setBooting(false);
      setActiveAction("");
    }
  }

  async function handleProfileCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      setError("Add a display name first.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("profile");
      setError("");
      setSuccess("");

      const profile = await createProfile(displayName.trim());
      const updatedProfiles = [profile, ...profiles];
      setProfiles(updatedProfiles);
      setDisplayName("");
      setActiveProfileId(profile.id);
      window.localStorage.setItem("climb-active-profile-id", profile.id);
      const profileClimbs = await fetchClimbsForProfile(profile.id);
      setClimbs(profileClimbs);
      setSuccess("Profile created. You can start logging climbs now.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleProfileSwitch(profileId: string) {
    setActiveProfileId(profileId);
    window.localStorage.setItem("climb-active-profile-id", profileId);
    setSuccess("");
    setError("");

    try {
      setLoading(true);
      setActiveAction("switch");
      const profileClimbs = await fetchClimbsForProfile(profileId);
      setClimbs(profileClimbs);
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleClimbSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeProfileId) {
      setError("Create or choose a profile first.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("climb");
      setError("");
      setSuccess("");

      let photoUrl = "";
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const climbPayload: ClimbInsert = {
        profile_id: activeProfileId,
        photo_url: photoUrl || null,
        grade: form.grade,
        style_tags: form.styleTags,
        wall_name: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
        climbed_on: form.date
      };

      await saveClimb(climbPayload);
      const updatedClimbs = await fetchClimbsForProfile(activeProfileId);
      setClimbs(updatedClimbs);
      setForm(DEFAULT_FORM);
      setPhotoFile(null);
      const input = document.getElementById("photo-upload") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      setSuccess("Climb logged.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  const stats = useMemo(() => buildStats(climbs), [climbs]);
  const recommendation = useMemo(() => nextGradeRecommendation(stats.completedByGrade), [stats.completedByGrade]);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;

  if (!supabaseReady) {
    return (
      <main className="shell">
        <section className="panel setup-panel">
          <p className="eyebrow">Setup needed</p>
          <h1>Climb Tracker</h1>
          <p>
            Add your Supabase keys to <code>.env.local</code> before running the app.
          </p>
          <p className="muted">
            The exact steps are included in <code>README.md</code>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Gym Progress Tracker</p>
          <h1>Keep every climb, session, and small win in one place.</h1>
          <p className="hero-copy">
            Log climbs fast on your phone, see which styles you love, and get a nudge when you are ready for the next grade.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-stat-label">Current level</p>
          <p className="hero-stat">{stats.level}</p>
          <p className="muted">{stats.xp} XP earned from completed climbs</p>
          <p className="recommendation">{recommendation}</p>
        </div>
      </section>

      {error ? (
        <section className="message error status-banner">
          <strong>Something needs attention:</strong> {error}
        </section>
      ) : null}

      {success ? (
        <section className="message success status-banner">
          <strong>Saved:</strong> {success}
        </section>
      ) : null}

      <section className="grid">
        <div className="stack">
          <section className="panel">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Your climber card</h2>
              </div>
              {activeProfile ? <span className="badge active">Active</span> : null}
            </div>

            <form className="stack-sm" onSubmit={handleProfileCreate}>
              <label className="field">
                <span>Display name</span>
                <input
                  type="text"
                  placeholder="Example: Jaron"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {activeAction === "profile" ? "Creating profile..." : "Create profile"}
              </button>
            </form>

            <div className="profile-list">
              {profiles.length === 0 ? (
                <p className="muted">No profiles yet. Create one above or load the seed data.</p>
              ) : (
                profiles.map((profile) => (
                  <button
                    className={clsx("profile-chip", profile.id === activeProfileId && "selected")}
                    key={profile.id}
                    onClick={() => void handleProfileSwitch(profile.id)}
                    type="button"
                  >
                    {profile.display_name}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">New climb</p>
                <h2>Log a problem</h2>
              </div>
              <span className="badge">Fast entry</span>
            </div>

            <p className="muted helper-copy">
              Add whatever helps you remember the climb. Description, notes, and photo are all optional.
            </p>

            <form className="stack-sm" onSubmit={handleClimbSubmit}>
              <div className="two-col">
                <label className="field">
                  <span>Grade</span>
                  <select
                    value={form.grade}
                    onChange={(event) => setForm((current) => ({ ...current, grade: event.target.value as ClimbRow["grade"] }))}
                  >
                    {CLIMB_GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ClimbRow["status"] }))}
                  >
                    <option value="attempted">Attempted</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Description</span>
                <input
                  type="text"
                  placeholder="North Cave, purple holds, slab corner..."
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Photo</span>
                <input
                  id="photo-upload"
                  accept="image/*"
                  type="file"
                  onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <div className="field">
                <span>Style tags</span>
                <div className="tag-grid">
                  {STYLE_TAGS.map((tag) => {
                    const selected = form.styleTags.includes(tag);
                    return (
                      <button
                        className={clsx("tag-button", selected && "selected")}
                        key={tag}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            styleTags: toggleStyleTag(current.styleTags, tag)
                          }))
                        }
                        type="button"
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea
                  placeholder="What felt hard? What clicked?"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <button className="primary-button" disabled={loading || booting} type="submit">
                {activeAction === "climb" ? "Saving climb..." : "Save climb"}
              </button>
            </form>
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Stats</p>
                <h2>Progress snapshot</h2>
              </div>
              <span className="badge xp-badge">{stats.xp} XP</span>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <span>Total climbs</span>
                <strong>{stats.totalClimbs}</strong>
              </article>
              <article className="stat-card">
                <span>Total completed</span>
                <strong>{stats.totalCompleted}</strong>
              </article>
              <article className="stat-card">
                <span>Favorite styles</span>
                <strong>{stats.favoriteStylesText}</strong>
              </article>
              <article className="stat-card">
                <span>Ready to move up?</span>
                <strong>{recommendation}</strong>
              </article>
            </div>

            <div className="grade-breakdown">
              <h3>Completed by grade</h3>
              {CLIMB_GRADES.map((grade) => {
                const count = stats.completedByGrade[grade] ?? 0;
                const unlocked = hasGraduatedGrade(stats.completedByGrade, grade);
                return (
                  <div className="grade-row" key={grade}>
                    <span>{grade}</span>
                    <div className="grade-bar-track">
                      <div className="grade-bar-fill" style={{ width: `${Math.min(count * 18, 100)}%` }} />
                    </div>
                    <strong>{count}</strong>
                    <span className={clsx("mini-badge", unlocked && "ready")}>{unlocked ? "solid" : "building"}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Feed</p>
                <h2>{activeProfile ? `${activeProfile.display_name}'s climbs` : "Choose a profile"}</h2>
              </div>
              <span className="badge">{climbs.length} entries</span>
            </div>

            {booting ? <p className="muted">Loading climbs...</p> : null}

            <div className="feed">
              {climbs.length === 0 ? (
                <p className="muted">No climbs logged yet. Add one above or load the sample data.</p>
              ) : (
                climbs.map((climb) => (
                  <article className="climb-card" key={climb.id}>
                    {climb.photo_url ? (
                      <img alt={`${climb.grade} climb`} className="climb-photo" src={climb.photo_url} />
                    ) : (
                      <div className="climb-photo placeholder">No photo</div>
                    )}
                    <div className="climb-content">
                      <div className="section-title-row">
                        <div>
                          <h3>
                            {climb.grade}
                            {climb.wall_name ? ` / ${climb.wall_name}` : ""}
                          </h3>
                          <p className="muted">
                            {prettyDate(climb.climbed_on)} / {climb.status}
                          </p>
                        </div>
                        <span className={clsx("badge", climb.status === "completed" ? "completed" : "attempted")}>
                          {climb.status}
                        </span>
                      </div>
                      <div className="tag-row">
                        {climb.style_tags.map((tag) => (
                          <span className="mini-badge" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      {climb.notes ? <p>{climb.notes}</p> : null}
                      {climb.status === "completed" ? <p className="xp-line">+{gradeToXp(climb.grade)} XP</p> : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function getMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeSupabaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      maybeSupabaseError.message,
      maybeSupabaseError.details,
      maybeSupabaseError.hint,
      maybeSupabaseError.code ? `Code: ${maybeSupabaseError.code}` : ""
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return "Something went wrong.";
}

function toggleStyleTag(selectedTags: StyleTag[], tag: StyleTag) {
  if (selectedTags.includes(tag)) {
    return selectedTags.filter((item) => item !== tag);
  }

  return [...selectedTags, tag];
}
