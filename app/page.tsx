"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CLIMB_COLORS, CLIMB_GRADES, DEFAULT_FORM, STYLE_TAG_GROUPS, climbToXp } from "@/lib/xp";
import { uploadPhoto } from "@/lib/local-store";
import {
  createDemoFriend,
  fetchFriendshipsForUser,
  fetchFriendFeed,
  fetchFriends,
  fetchIncomingRequests,
  removeFriendship,
  respondToFriendRequest,
  searchProfiles,
  sendFriendRequest
} from "@/lib/friends-store";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import {
  deleteClimbForUser,
  deleteCurrentAccount,
  ensureProfile,
  fetchClimbsForUser,
  fetchProfile,
  getCurrentUser,
  saveClimbForUser,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
  updateProfileAvatar,
  updateDisplayName,
  updateClimbForUser
} from "@/lib/supabase-store";
import type {
  ClimbInsert,
  ClimbRow,
  FriendFeedClimb,
  FriendSummary,
  IncomingFriendRequest,
  ProfileRow,
  ProfileSearchRow,
  StyleTag
} from "@/lib/types";
import { buildProgressStats, buildStats, prettyDate, PROGRESS_RANGES, type ProgressRange } from "@/lib/stats";

export default function HomePage() {
  const [activeProfile, setActiveProfile] = useState<ProfileRow | null>(null);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [climbs, setClimbs] = useState<ClimbRow[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [activeView, setActiveView] = useState<"home" | "history" | "friends" | "account" | "progress">("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const cameraButtonRef = useRef<HTMLButtonElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const historyTopRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeAction, setActiveAction] = useState<"auth" | "rename" | "avatar" | "logout" | "account-delete" | "climb" | "edit" | "load" | "delete" | "">("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [climbPendingDelete, setClimbPendingDelete] = useState<ClimbRow | null>(null);
  const [editingClimb, setEditingClimb] = useState<ClimbRow | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showSaveBurst, setShowSaveBurst] = useState(false);
  const [historyGradeFilter, setHistoryGradeFilter] = useState<"All" | ClimbRow["grade"]>("All");
  const [historyTagQuery, setHistoryTagQuery] = useState("");
  const [historyVisibleCount, setHistoryVisibleCount] = useState(20);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<ProfileSearchRow[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendFeed, setFriendFeed] = useState<FriendFeedClimb[]>([]);
  const [pendingOutgoingFriendIds, setPendingOutgoingFriendIds] = useState<string[]>([]);
  const [friendsTab, setFriendsTab] = useState<"discover" | "requests" | "circle">("circle");
  const [progressRange, setProgressRange] = useState<ProgressRange>("ALL");

  const hydrateFriendState = useCallback(
    async (userId: string) => {
      try {
        const [friendships, requests, acceptedFriends, feed] = await Promise.all([
          fetchFriendshipsForUser(userId),
          fetchIncomingRequests(userId),
          fetchFriends(userId),
          fetchFriendFeed(userId)
        ]);
        setPendingOutgoingFriendIds(
          friendships.filter((item) => item.requester_id === userId && item.status === "pending").map((item) => item.addressee_id)
        );
        setIncomingRequests(requests);
        setFriends(acceptedFriends);
        setFriendFeed(feed);
      } catch (err) {
        setPendingOutgoingFriendIds([]);
        setIncomingRequests([]);
        setFriends([]);
        setFriendFeed([]);

        const message = getMessage(err);
        if (message.toLowerCase().includes("friendships")) {
          setError("Friends is almost ready. Run the updated Supabase schema to enable friend requests and the friend feed.");
          return;
        }

        throw err;
      }
    },
    []
  );

  const syncUserData = useCallback(async (userId: string) => {
    if (!userId) {
      setActiveProfile(null);
      setActiveProfileId("");
      setCurrentUserEmail("");
      setAccountDisplayName("");
      setClimbs([]);
      setFriendSearch("");
      setFriendResults([]);
      setIncomingRequests([]);
      setFriends([]);
      setFriendFeed([]);
      setPendingOutgoingFriendIds([]);
      setEditingClimb(null);
      setIsComposerOpen(false);
      setActiveView("home");
      setIsMenuOpen(false);
      return;
    }

    const profile = await fetchProfile(userId);
    setActiveProfile(profile);
    setActiveProfileId(userId);
    setAccountDisplayName(profile?.display_name ?? "");

    const profileClimbs = await fetchClimbsForUser(userId);
    setClimbs(profileClimbs);
    await hydrateFriendState(userId);
  }, [hydrateFriendState]);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setBooting(false);
      return;
    }

    async function initialize() {
      try {
        setBooting(true);
        setActiveAction("load");
        setError("");
        const user = await getCurrentUser();
        await syncUserData(user?.id ?? "");
      } catch (err) {
        setError(getMessage(err));
      } finally {
        setBooting(false);
        setActiveAction("");
      }
    }

    void initialize();

    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUserEmail(user?.email ?? "");
      void syncUserData(user?.id ?? "").catch((err) => {
        setError(getMessage(err));
      });
    });

    return unsubscribe;
  }, [syncUserData]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cameraButtonRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [isComposerOpen]);

  useEffect(() => {
    setHistoryVisibleCount(20);
  }, [historyGradeFilter, historyTagQuery]);

  useEffect(() => {
    if (friends.length === 0) {
      setSelectedFriendId("");
      return;
    }

    if (!friends.some((friend) => friend.friendId === selectedFriendId)) {
      setSelectedFriendId(friends[0].friendId);
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    if (!activeProfileId || activeView !== "friends") {
      return;
    }

    const trimmed = friendSearch.trim();
    if (!trimmed) {
      setFriendResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchProfiles(trimmed, activeProfileId);
          setFriendResults(results);
        } catch (err) {
          setError(getMessage(err));
        }
      })();
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [activeProfileId, activeView, friendSearch]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Add your email and password first.");
      setSuccess("");
      return;
    }

    if (authMode === "signup" && !displayName.trim()) {
      setError("Add a display name first.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("auth");
      setError("");
      setSuccess("");

      if (authMode === "signup") {
        const user = await signUpWithEmail(email.trim(), password, displayName.trim());
        if (!user) {
          throw new Error("Account created, but no session was returned. In Supabase, turn off email confirmation for now or sign in after confirming your email.");
        }

        await ensureProfile(user.id, displayName.trim());
        setCurrentUserEmail(user.email ?? "");
        await syncUserData(user.id);
        setSuccess("Account created. You can start logging climbs now.");
      } else {
        const user = await signInWithEmail(email.trim(), password);
        setCurrentUserEmail(user.email ?? "");
        await syncUserData(user.id);
        setSuccess("Signed in.");
      }

      setEmail("");
      setPassword("");
      if (authMode === "signup") {
        setDisplayName("");
      }
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleSignOut() {
    try {
      setLoading(true);
      setActiveAction("logout");
      setError("");
      setSuccess("");
      await signOutUser();
      await syncUserData("");
      setSuccess("Signed out.");
    } catch (err) {
      const message = getMessage(err);
      setError(message);
      if (message.includes("already has an account")) {
        setAuthMode("signin");
      }
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleDisplayNameSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeProfileId) {
      return;
    }

    if (!accountDisplayName.trim()) {
      setError("Add a display name first.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("rename");
      setError("");
      setSuccess("");

      const updatedProfile = await updateDisplayName(activeProfileId, accountDisplayName.trim());
      setActiveProfile(updatedProfile);
      setAccountDisplayName(updatedProfile.display_name);
      setSuccess("Name updated.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (!selected || !activeProfileId) {
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file for your profile photo.");
      setSuccess("");
      event.target.value = "";
      return;
    }

    try {
      setLoading(true);
      setActiveAction("avatar");
      setError("");
      setSuccess("");

      const avatarUrl = await uploadPhoto(selected);
      const updatedProfile = await updateProfileAvatar(activeProfileId, avatarUrl);
      setActiveProfile(updatedProfile);
      setAccountDisplayName(updatedProfile.display_name);
      await refreshFriendsView();
      setSuccess("Profile photo updated.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
      event.target.value = "";
    }
  }

  async function handleAccountDelete() {
    if (!window.confirm("Delete your account and all climbs? This cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      setActiveAction("account-delete");
      setError("");
      setSuccess("");
      await deleteCurrentAccount();
      await syncUserData("");
      setSuccess("Account deleted.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      setPhotoFile(null);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file.");
      setSuccess("");
      setPhotoFile(null);
      event.target.value = "";
      return;
    }

    setError("");
    setPhotoFile(selected);
  }
  async function handleClimbSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeProfileId) {
      setError("Create your climber profile first.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction(editingClimb ? "edit" : "climb");
      setError("");
      setSuccess("");

      let photoUrl = editingClimb?.photo_url ?? "";
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const climbPayload: Omit<ClimbInsert, "profile_id"> = {
        photo_url: photoUrl || null,
        grade: form.grade,
        flashed: form.flashed,
        grade_modifier: form.gradeModifier,
        style_tags: form.styleTags,
        wall_name: form.color.trim() || null,
        notes: form.notes.trim() || null,
        status: "completed",
        climbed_on: form.date
      };

      if (editingClimb) {
        await updateClimbForUser(activeProfileId, editingClimb.id, climbPayload);
      } else {
        await saveClimbForUser(activeProfileId, climbPayload);
      }
      const updatedClimbs = await fetchClimbsForUser(activeProfileId);
      setClimbs(updatedClimbs);
      setForm(DEFAULT_FORM);
      setPhotoFile(null);
      setEditingClimb(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      if (cameraCaptureInputRef.current) {
        cameraCaptureInputRef.current.value = "";
      }
      setIsComposerOpen(false);
      setShowSaveBurst(true);
      window.setTimeout(() => setShowSaveBurst(false), 1600);
      setSuccess(editingClimb ? "Climb updated." : "Climb logged.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handleDeleteClimb(climbId: string) {
    try {
      setLoading(true);
      setActiveAction("delete");
      setError("");
      setSuccess("");

      await deleteClimbForUser(activeProfileId, climbId);
      if (activeProfileId) {
        const updatedClimbs = await fetchClimbsForUser(activeProfileId);
        setClimbs(updatedClimbs);
      }
      setClimbPendingDelete(null);
      setSuccess("Climb deleted.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  function openComposer() {
    setEditingClimb(null);
    setForm(DEFAULT_FORM);
    setPhotoFile(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.value = "";
    }
    setIsComposerOpen(true);
  }

  function openEditor(climb: ClimbRow) {
    setEditingClimb(climb);
    setForm({
      grade: climb.grade,
      flashed: Boolean(climb.flashed),
      gradeModifier: climb.grade_modifier ?? null,
      styleTags: climb.style_tags,
      color: climb.wall_name ?? "",
      notes: climb.notes ?? "",
      date: climb.climbed_on
    });
    setPhotoFile(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.value = "";
    }
    setIsComposerOpen(true);
  }

  const stats = useMemo(() => buildStats(climbs), [climbs]);
  const progressStats = useMemo(() => buildProgressStats(climbs, progressRange), [climbs, progressRange]);
  const maxGradeCount = useMemo(
    () => Math.max(1, ...CLIMB_GRADES.map((grade) => stats.completedByGrade[grade] ?? 0)),
    [stats.completedByGrade]
  );
  const filteredClimbs = useMemo(
    () => {
      const normalizedQuery = historyTagQuery.trim().toLowerCase();

      return climbs.filter((climb) => {
        const matchesGrade = historyGradeFilter === "All" || climb.grade === historyGradeFilter;
        const matchesTag =
          normalizedQuery.length === 0 ||
          climb.style_tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
          climb.wall_name?.toLowerCase().includes(normalizedQuery) ||
          (normalizedQuery === "flash" && Boolean(climb.flashed));

        return matchesGrade && matchesTag;
      });
    },
    [climbs, historyGradeFilter, historyTagQuery]
  );
  const recentClimbs = filteredClimbs.slice(0, 8);
  const visibleHistoryClimbs = filteredClimbs.slice(0, historyVisibleCount);
  const hasMoreHistory = filteredClimbs.length > historyVisibleCount;
  const canSaveClimb = Boolean(activeProfileId) && !loading && !booting;
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.friendId === selectedFriendId) ?? friends[0] ?? null,
    [friends, selectedFriendId]
  );
  const selectedGradeCounts = progressRange === "ALL" ? stats.completedByGrade : progressStats.completedByGrade;
  const selectedGradeMax = useMemo(
    () => Math.max(1, ...CLIMB_GRADES.map((grade) => selectedGradeCounts[grade] ?? 0)),
    [selectedGradeCounts]
  );
  const trendChart = useMemo(() => {
    const buckets = progressStats.buckets;
    const width = 100;
    const height = 48;
    const topPadding = 6;
    const bottomPadding = 6;
    const chartHeight = height - topPadding - bottomPadding;
    const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.climbCount));
    const yAxisMarks = Array.from(new Set([maxValue, Math.max(0, Math.round(maxValue / 2)), 0])).sort((a, b) => b - a);

    const points = buckets.map((bucket, index) => {
      const x = buckets.length === 1 ? width / 2 : (index / (buckets.length - 1)) * width;
      const y = topPadding + chartHeight - (bucket.climbCount / maxValue) * chartHeight;
      return { x, y, bucket };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");

    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - bottomPadding} L ${points[0].x.toFixed(2)} ${height - bottomPadding} Z`
      : "";

    return { areaPath, linePath, points, yAxisMarks, maxValue, height, topPadding, bottomPadding, chartHeight };
  }, [progressStats.buckets]);

  function selectView(view: "home" | "history" | "friends" | "account" | "progress") {
    setActiveView(view);
    setIsMenuOpen(false);
  }

  function openHistoryView() {
    selectView("history");

    window.requestAnimationFrame(() => {
      historyTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function clearHistoryFilters() {
    setHistoryGradeFilter("All");
    setHistoryTagQuery("");
  }

  async function refreshFriendsView() {
    if (!activeProfileId) {
      return;
    }

    await hydrateFriendState(activeProfileId);
  }

  async function handleSendFriendRequest(targetProfileId: string) {
    if (!activeProfileId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await sendFriendRequest(activeProfileId, targetProfileId);
      await refreshFriendsView();
      setSuccess("Friend request sent.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFriendRequestResponse(friendshipId: string, status: "accepted" | "declined") {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await respondToFriendRequest(friendshipId, status);
      await refreshFriendsView();
      setSuccess(status === "accepted" ? "Friend request accepted." : "Friend request declined.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await removeFriendship(friendshipId);
      await refreshFriendsView();
      setSuccess("Friend removed.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDemoFriend() {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const demoName = await createDemoFriend();
      await refreshFriendsView();
      setSuccess(`${demoName} is ready in your friend feed.`);
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function renderHistorySection({
    eyebrow,
    title,
    climbsToShow,
    countLabel,
    showViewAll = false,
    showLoadMore = false
  }: {
    eyebrow: string;
    title: string;
    climbsToShow: ClimbRow[];
    countLabel: string;
    showViewAll?: boolean;
    showLoadMore?: boolean;
  }) {
    return (
      <section className="panel history-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <span className="badge">{countLabel}</span>
        </div>

        <div className="history-toolbar">
          <div className="history-filter-header">
            <button
              className={clsx("filter-chip filter-chip-all", historyGradeFilter === "All" && "active")}
              onClick={() => setHistoryGradeFilter("All")}
              type="button"
            >
              All
            </button>
            {historyGradeFilter !== "All" || historyTagQuery.trim() ? (
              <button className="history-clear-button" onClick={clearHistoryFilters} type="button">
                × Clear
              </button>
            ) : null}
          </div>
          <div className="history-filter-row">
            {CLIMB_GRADES.map((grade) => (
              <button
                className={clsx("filter-chip", historyGradeFilter === grade && "active")}
                key={grade}
                onClick={() => setHistoryGradeFilter(grade)}
                type="button"
              >
                {grade}
              </button>
            ))}
          </div>
          <p className="muted history-summary">
            {historyTagQuery.trim()
              ? `Filtered by tag search "${historyTagQuery.trim()}"${historyGradeFilter === "All" ? "" : ` and ${historyGradeFilter}`}.`
              : historyGradeFilter === "All"
                ? `Showing everything you have logged so far.`
                : `Showing your ${historyGradeFilter} climbs so you can quickly see repeats and notes.`}
          </p>
          <label className="field history-search-field">
            <span>Search tags</span>
            <input
              placeholder="Try slab, flash, dynamic..."
              type="search"
              value={historyTagQuery}
              onChange={(event) => setHistoryTagQuery(event.target.value)}
            />
          </label>
        </div>

        {booting ? <p className="muted">Loading climbs...</p> : null}

        <div className="feed history-feed">
          {climbsToShow.length === 0 ? (
            <p className="empty-copy">
              {historyGradeFilter === "All"
                ? historyTagQuery.trim()
                  ? `No climbs match "${historyTagQuery.trim()}". Try a different tag search.`
                  : "No climbs yet. Tap Add climb to log your first send."
                : historyTagQuery.trim()
                  ? `No ${historyGradeFilter} climbs match "${historyTagQuery.trim()}".`
                  : `No ${historyGradeFilter} climbs yet. Pick another filter or add one.`}
            </p>
          ) : (
            climbsToShow.map((climb) => (
              <article className="climb-card" key={climb.id}>
                {climb.photo_url ? (
                  <button className="thumbnail-button" onClick={() => setSelectedPhotoUrl(climb.photo_url)} type="button">
                    <img alt={`${climb.grade} climb`} className="climb-photo" src={climb.photo_url} />
                  </button>
                ) : null}
                <div className="climb-content">
                  <div className="section-title-row">
                    <div>
                      <div className="history-title-row">
                        <h3>
                          {climb.grade}
                          {climb.grade_modifier ?? ""}
                        </h3>
                        {climb.wall_name ? (
                          <span
                            className={clsx(
                              "history-description",
                              getColorChipClass(climb.wall_name)
                            )}
                          >
                            {climb.wall_name}
                          </span>
                        ) : null}
                      </div>
                      <p className="muted history-meta">{prettyDate(climb.climbed_on)}</p>
                    </div>
                  </div>
                  <div className="tag-row">
                    {climb.flashed ? <span className="mini-badge ready">flash</span> : null}
                    {climb.style_tags.map((tag) => (
                      <span className="mini-badge" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {climb.notes ? <p>{climb.notes}</p> : null}
                  <div className="climb-actions">
                    <p className="xp-line">+{climbToXp(climb.grade, Boolean(climb.flashed), climb.grade_modifier ?? null)} XP</p>
                    <div className="climb-action-buttons">
                      <button className="secondary-button climb-edit-button" disabled={loading} onClick={() => openEditor(climb)} type="button">
                        Edit climb
                      </button>
                      <button className="delete-button" disabled={loading} onClick={() => setClimbPendingDelete(climb)} type="button">
                        Delete climb
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {showViewAll || showLoadMore ? (
          <div className="history-footer">
            {showViewAll ? (
              <button className="secondary-button" onClick={openHistoryView} type="button">
                View all history
              </button>
            ) : null}
            {showLoadMore && hasMoreHistory ? (
              <button className="secondary-button" onClick={() => setHistoryVisibleCount((current) => current + 20)} type="button">
                Load 20 more
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <main className="shell shell-dashboard">
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

      {selectedPhotoUrl ? (
        <div className="lightbox" onClick={() => setSelectedPhotoUrl(null)} role="button" tabIndex={0}>
          <button
            className="lightbox-close"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPhotoUrl(null);
            }}
            type="button"
          >
            Close
          </button>
          <img
            alt="Full climb"
            className="lightbox-image"
            onClick={(event) => event.stopPropagation()}
            src={selectedPhotoUrl}
          />
        </div>
      ) : null}

      {climbPendingDelete ? (
        <div className="lightbox confirm-overlay" onClick={() => setClimbPendingDelete(null)} role="button" tabIndex={0}>
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <p className="eyebrow">Delete climb</p>
            <h2>
              Remove {climbPendingDelete.grade}
              {climbPendingDelete.wall_name ? ` / ${climbPendingDelete.wall_name}` : ""}?
            </h2>
            <p className="muted">
              This will remove the climb from your history, update your XP and stats, and delete the photo from cloud storage if it has one.
            </p>
            <div className="confirm-actions">
              <button className="secondary-button" onClick={() => setClimbPendingDelete(null)} type="button">
                Cancel
              </button>
              <button
                className="delete-button"
                disabled={loading}
                onClick={() => void handleDeleteClimb(climbPendingDelete.id)}
                type="button"
              >
                {activeAction === "delete" ? "Deleting..." : "Delete climb"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isComposerOpen ? (
        <div className="composer-root">
          <div className="composer-backdrop" onClick={() => setIsComposerOpen(false)} />
          <section className="composer-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="section-title-row composer-header">
              <div>
                <p className="eyebrow">{editingClimb ? "Edit climb" : "New climb"}</p>
                <h2>{editingClimb ? "Update climb" : "Add a climb"}</h2>
              </div>
              <button className="secondary-button" onClick={() => setIsComposerOpen(false)} type="button">
                Close
              </button>
            </div>

            <p className="muted helper-copy">
              {editingClimb ? "Update anything you want to keep track of. Retake the photo only if you want to replace it." : "Save the essentials first. Color and notes are just memory helpers."}
            </p>

            <form className="stack-sm" onSubmit={handleClimbSubmit}>
              <label className="field">
                <span>Photo</span>
                <div className="photo-button-row">
                  <button className="camera-button" onClick={() => cameraCaptureInputRef.current?.click()} ref={cameraButtonRef} type="button">
                    {photoFile ? "Retake photo" : editingClimb?.photo_url ? "Replace photo" : "Take photo"}
                  </button>
                  <button className="secondary-button photo-picker-button" onClick={() => photoInputRef.current?.click()} type="button">
                    Choose file
                  </button>
                </div>
                <input
                  id="photo-upload"
                  ref={photoInputRef}
                  accept="image/*"
                  type="file"
                  onChange={handlePhotoChange}
                  className="hidden-file-input"
                />
                <input
                  ref={cameraCaptureInputRef}
                  accept="image/*"
                  capture="environment"
                  type="file"
                  onChange={handlePhotoChange}
                  className="hidden-file-input"
                />
                <small className="muted">
                  {photoFile
                    ? `${photoFile.name} ready to upload.`
                    : editingClimb?.photo_url
                      ? "Leave this alone to keep the current photo."
                      : ""}
                </small>
              </label>

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

              <div className="field">
                <span>Grade modifier</span>
                <div className="modifier-row" role="group" aria-label="Grade modifier">
                  {(["-", "+"] as const).map((modifier) => (
                    <button
                      className={clsx("modifier-button", form.gradeModifier === modifier && "selected")}
                      key={modifier}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          gradeModifier: current.gradeModifier === modifier ? null : modifier
                        }))
                      }
                      type="button"
                    >
                      {modifier}
                    </button>
                  ))}
                </div>
              </div>

              <label className="check-row" htmlFor="flash-toggle">
                <div>
                  <span className="check-row-label">Flash</span>
                  <p className="muted check-row-copy">Completed first try for 1.35x XP.</p>
                </div>
                <input
                  checked={form.flashed}
                  id="flash-toggle"
                  onChange={(event) => setForm((current) => ({ ...current, flashed: event.target.checked }))}
                  type="checkbox"
                />
              </label>

              <label className="field">
                <span>Color</span>
                <select value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}>
                  <option value="">No color</option>
                  {CLIMB_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-compact">
                <span>Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <section className="tag-section">
                <div className="tag-section-header">
                  <p className="eyebrow">Style tags</p>
                </div>
                <div className="tag-groups">
                  {STYLE_TAG_GROUPS.map((group) => {
                    const groupBody = (
                      <div className="tag-grid">
                        {group.tags.map((tag) => {
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
                    );

                    return (
                      <div className="tag-group" key={group.label}>
                        <p className="tag-group-label">{group.label}</p>
                        {groupBody}
                      </div>
                    );
                  })}
                </div>
              </section>

              <label className="field">
                <span>Notes</span>
                <textarea
                  placeholder="What felt hard? What clicked?"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <button className="primary-button" disabled={!canSaveClimb} type="submit">
                {activeAction === "edit" ? "Saving changes..." : activeAction === "climb" ? "Saving climb..." : editingClimb ? "Save changes" : "Save climb"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {!hasSupabaseConfig() ? (
        <section className="panel onboarding-panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Supabase</p>
              <h1>Connect your account system</h1>
            </div>
          </div>
          <p className="muted helper-copy">Add your Supabase URL and anon key to `.env.local`, then restart the app.</p>
          <div className="inline-note">This account-backed version needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before it can load.</div>
        </section>
      ) : !activeProfile ? (
        <section className="panel onboarding-panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Welcome</p>
              <h1>{authMode === "signup" ? "Create your account" : "Sign in"}</h1>
            </div>
          </div>
          <p className="muted helper-copy">Your climbs will be tied to your account, so they won’t be stuck on one device.</p>
          <div className="auth-toggle-row">
            <button className={clsx("filter-chip", authMode === "signup" && "active")} onClick={() => setAuthMode("signup")} type="button">
              Sign up
            </button>
            <button className={clsx("filter-chip", authMode === "signin" && "active")} onClick={() => setAuthMode("signin")} type="button">
              Sign in
            </button>
          </div>
          <form className="stack-sm" onSubmit={handleAuthSubmit}>
            {authMode === "signup" ? (
              <label className="field">
                <span>Display name</span>
                <input
                  type="text"
                  placeholder="Example: Jaron"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            ) : null}
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              {activeAction === "auth"
                ? authMode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : authMode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <header className="app-header">
            <button
              aria-expanded={isMenuOpen}
              className="menu-button"
              onClick={() => setIsMenuOpen((current) => !current)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className="eyebrow">Climb Tracker</p>
              <h2 className="app-header-title">
                {activeView === "home"
                  ? "Dashboard"
                  : activeView === "history"
                    ? "History"
                    : activeView === "friends"
                      ? "Friends"
                      : activeView === "account"
                        ? "Account"
                        : "Progress"}
              </h2>
            </div>
          </header>

          {isMenuOpen ? (
            <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}>
              <nav className="menu-panel" onClick={(event) => event.stopPropagation()}>
                <button className={clsx("menu-link", activeView === "home" && "active")} onClick={() => selectView("home")} type="button">
                  Dashboard
                </button>
                <button className={clsx("menu-link", activeView === "history" && "active")} onClick={() => selectView("history")} type="button">
                  History
                </button>
                <button className={clsx("menu-link", activeView === "friends" && "active")} onClick={() => selectView("friends")} type="button">
                  Friends
                </button>
                <button className={clsx("menu-link", activeView === "progress" && "active")} onClick={() => selectView("progress")} type="button">
                  Progress
                </button>
                <button className={clsx("menu-link", activeView === "account" && "active")} onClick={() => selectView("account")} type="button">
                  Account
                </button>
              </nav>
            </div>
          ) : null}

          {activeView === "home" ? (
            <>
              <section className="dashboard-top">
                <section className={clsx("hero-card level-card", showSaveBurst && "save-burst")}>
                  <div className="section-title-row compact-gap">
                    <div>
                      <p className="eyebrow">Current level</p>
                      <h1 className="dashboard-level">{stats.level}</h1>
                    </div>
                    <div className="dashboard-meta">
                      <span className="badge active">{activeProfile.display_name}</span>
                      <span className="dashboard-xp-total">{stats.xp} XP total</span>
                    </div>
                  </div>
                  <div className="xp-progress-block">
                    <div className="xp-progress-labels">
                      <span>{stats.xpThisLevel} / {stats.xpNextLevel} XP to next level</span>
                      <span>{Math.round(stats.xpProgressPercent)}%</span>
                    </div>
                    <div aria-hidden="true" className="xp-progress-track">
                      <div className="xp-progress-fill" style={{ width: `${stats.xpProgressPercent}%` }} />
                    </div>
                  </div>
                </section>
              </section>

              <section className="dashboard-grid">
                <section className="panel progress-panel">
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">Daily recap</p>
                      <h2>{progressStats.dailyRecap?.headline ?? "No session logged yet"}</h2>
                    </div>
                  </div>

                  {progressStats.dailyRecap ? (
                    <>
                      <p className="muted daily-recap-subtitle dashboard-recap-subtitle">
                        {progressStats.dailyRecap.isToday
                          ? `Today | ${prettyDate(progressStats.dailyRecap.climbedOn)}`
                          : `Last session | ${prettyDate(progressStats.dailyRecap.climbedOn)}`}
                      </p>
                      <div className="daily-recap-pill-row dashboard-recap-pills">
                        <span className="daily-pill">{progressStats.dailyRecap.sends} sends</span>
                        <span className="daily-pill">+{progressStats.dailyRecap.totalXp} XP</span>
                        {progressStats.dailyRecap.topGrade ? <span className="daily-pill">Top send {progressStats.dailyRecap.topGrade}</span> : null}
                      </div>
                      <div className="daily-recap-list">
                        {progressStats.dailyRecap.groups.map((group) => (
                          <div className="daily-recap-row" key={group.label}>
                            <div className="daily-recap-row-main">
                              <div className="daily-recap-row-labels">
                                <strong>{group.label}</strong>
                                <span className="muted">
                                  {group.count} climb{group.count > 1 ? "s" : ""}
                                  {group.flashedCount > 0 ? ` | ${group.flashedCount} flash${group.flashedCount > 1 ? "es" : ""}` : ""}
                                </span>
                              </div>
                              <div className="daily-recap-bar-track" aria-hidden="true">
                                <div className="daily-recap-bar-fill" style={{ width: `${group.fillPercent}%` }} />
                              </div>
                            </div>
                            <span className="daily-recap-xp">+{group.xp}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="empty-copy">Log a climb and your most recent session recap will show up here.</p>
                  )}
                </section>

                {renderHistorySection({
                  eyebrow: "History",
                  title: "Recent climbs",
                  climbsToShow: recentClimbs,
                  countLabel: `${recentClimbs.length} of ${filteredClimbs.length}`,
                  showViewAll: filteredClimbs.length > recentClimbs.length
                })}
              </section>

              <button className="fab-button" onClick={openComposer} type="button">
                Add climb
              </button>
            </>
          ) : null}

          {activeView === "account" ? (
            <section className="account-grid">
              <section className="panel">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Account</p>
                    <h2>Your settings</h2>
                  </div>
                </div>

                <div className="account-profile-hero">
                  {renderProfileAvatar(activeProfile.display_name, activeProfile.avatar_url, "account-avatar account-avatar-large")}
                  <div className="account-profile-copy">
                    <strong>{activeProfile.display_name}</strong>
                    <p className="muted">Your photo shows up in Friends and helps your circle recognize you faster.</p>
                    <input
                      accept="image/*"
                      className="hidden-file-input"
                      onChange={handleAvatarChange}
                      ref={avatarInputRef}
                      type="file"
                    />
                    <button
                      className="secondary-button"
                      disabled={loading}
                      onClick={() => avatarInputRef.current?.click()}
                      type="button"
                    >
                      {activeAction === "avatar" ? "Uploading..." : activeProfile.avatar_url ? "Change profile photo" : "Add profile photo"}
                    </button>
                  </div>
                </div>

                <div className="account-summary">
                  <div className="account-line">
                    <span>Email</span>
                    <strong>{currentUserEmail || "Signed in"}</strong>
                  </div>
                  <div className="account-line">
                    <span>Climber name</span>
                    <strong>{activeProfile.display_name}</strong>
                  </div>
                  <div className="account-line">
                    <span>Total climbs</span>
                    <strong>{climbs.length}</strong>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Profile</p>
                    <h2>Change your name</h2>
                  </div>
                </div>
                <form className="stack-sm" onSubmit={handleDisplayNameSave}>
                  <label className="field">
                    <span>Display name</span>
                    <input
                      type="text"
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                    />
                  </label>
                  <button className="primary-button" disabled={loading} type="submit">
                    {activeAction === "rename" ? "Saving..." : "Save name"}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Actions</p>
                    <h2>Manage account</h2>
                  </div>
                </div>
                <div className="account-actions">
                  <button className="secondary-button" disabled={loading} onClick={() => void handleSignOut()} type="button">
                    {activeAction === "logout" ? "Signing out..." : "Sign out"}
                  </button>
                  <button className="delete-button" disabled={loading} onClick={() => void handleAccountDelete()} type="button">
                    {activeAction === "account-delete" ? "Deleting account..." : "Delete account"}
                  </button>
                </div>
                <p className="muted">Deleting your account removes your profile, climbs, and sign-in from this app.</p>
              </section>
            </section>
          ) : null}

          {activeView === "history" ? (
            <section className="history-view" ref={historyTopRef}>
              {renderHistorySection({
                eyebrow: "History",
                title: "All climbs",
                climbsToShow: visibleHistoryClimbs,
                countLabel: `${visibleHistoryClimbs.length} of ${filteredClimbs.length}`,
                showLoadMore: true
              })}
            </section>
          ) : null}

          {activeView === "friends" ? (
            <section className="friends-page">
              <section className="panel friends-shell">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Friends</p>
                    <h2>{friendsTab === "discover" ? "Find climbers" : friendsTab === "requests" ? "Requests" : "Your circle"}</h2>
                  </div>
                  {friendsTab === "discover" ? (
                    <button className="secondary-button friend-demo-button" disabled={loading} onClick={() => void handleCreateDemoFriend()} type="button">
                      Add demo friend
                    </button>
                  ) : null}
                </div>

                <div className="friends-tab-row" role="tablist" aria-label="Friends sections">
                  <button className={clsx("friends-tab", friendsTab === "discover" && "active")} onClick={() => setFriendsTab("discover")} type="button">
                    Discover
                  </button>
                  <button className={clsx("friends-tab", friendsTab === "requests" && "active")} onClick={() => setFriendsTab("requests")} type="button">
                    Requests
                    {incomingRequests.length > 0 ? <span className="friends-tab-count">{incomingRequests.length}</span> : null}
                  </button>
                  <button className={clsx("friends-tab", friendsTab === "circle" && "active")} onClick={() => setFriendsTab("circle")} type="button">
                    Circle
                    <span className="friends-tab-count">{friends.length}</span>
                  </button>
                </div>

                {friendsTab === "discover" ? (
                  <div className="friends-tab-panel">
                    <p className="muted friends-section-copy">Search by climber name, send a request, and start sharing sends with your circle.</p>
                    <label className="field">
                      <span>Search by climber name</span>
                      <input
                        type="search"
                        placeholder="Search display names..."
                        value={friendSearch}
                        onChange={(event) => setFriendSearch(event.target.value)}
                      />
                    </label>
                    <div className="friends-search-results">
                      {friendSearch.trim().length === 0 ? (
                        <p className="empty-copy">Search for a climber by display name to send a friend request.</p>
                      ) : friendResults.length === 0 ? (
                        <p className="empty-copy">No climbers matched that search yet.</p>
                      ) : (
                        friendResults.map((result) => {
                          const alreadyFriends = friends.some((friend) => friend.friendId === result.id);
                          const alreadyIncoming = incomingRequests.some((request) => request.requesterId === result.id);
                          const alreadyPending = pendingOutgoingFriendIds.includes(result.id);

                          return (
                            <article className="friend-row" key={result.id}>
                              <div className="friend-row-main">
                                {renderProfileAvatar(result.display_name, result.avatar_url, "friend-avatar")}
                                <div>
                                  <strong>{result.display_name}</strong>
                                  <p className="muted friend-row-meta">Tap below to send a friend request.</p>
                                </div>
                              </div>
                              <button
                                className="secondary-button"
                                disabled={loading || alreadyFriends || alreadyIncoming || alreadyPending}
                                onClick={() => void handleSendFriendRequest(result.id)}
                                type="button"
                              >
                                {alreadyFriends ? "Friends" : alreadyIncoming ? "Requested you" : alreadyPending ? "Pending" : "Add friend"}
                              </button>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                {friendsTab === "requests" ? (
                  <div className="friends-tab-panel">
                    {incomingRequests.length === 0 ? (
                      <p className="empty-copy">No incoming requests right now.</p>
                    ) : (
                      <div className="friends-list">
                        {incomingRequests.map((request) => (
                          <article className="friend-row" key={request.friendshipId}>
                            <div className="friend-row-main">
                              <div className="friend-avatar">{initialsForName(request.requesterName)}</div>
                              <div>
                                <strong>{request.requesterName}</strong>
                                <p className="muted friend-row-meta">Requested {prettyDate(request.createdAt)}</p>
                              </div>
                            </div>
                            <div className="friend-row-actions">
                              <button
                                className="primary-button friend-action-button"
                                disabled={loading}
                                onClick={() => void handleFriendRequestResponse(request.friendshipId, "accepted")}
                                type="button"
                              >
                                Accept
                              </button>
                              <button
                                className="secondary-button friend-action-button"
                                disabled={loading}
                                onClick={() => void handleFriendRequestResponse(request.friendshipId, "declined")}
                                type="button"
                              >
                                Decline
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {friendsTab === "circle" ? (
                  <div className="friends-tab-panel friends-circle-layout">
                    <section className="friends-circle-panel">
                      {selectedFriend ? (
                        <article className="friend-spotlight">
                          <div className="section-title-row friend-spotlight-header">
                            <div>
                              <p className="eyebrow">Circle spotlight</p>
                              <h3>{selectedFriend.friendName}</h3>
                            </div>
                            <span className="friend-level-badge friend-spotlight-level">Lv {selectedFriend.level}</span>
                          </div>
                          <div className="friend-spotlight-main">
                            {renderProfileAvatar(selectedFriend.friendName, selectedFriend.avatarUrl, "account-avatar friend-spotlight-avatar")}
                            <div className="friend-spotlight-copy">
                              <p className="muted">Connected {prettyDate(selectedFriend.createdAt)}</p>
                              <div className="friend-spotlight-stats">
                                <div className="friend-spotlight-stat">
                                  <span>Total sends</span>
                                  <strong>{selectedFriend.totalSends}</strong>
                                </div>
                                <div className="friend-spotlight-stat">
                                  <span>Personal best</span>
                                  <strong>{selectedFriend.personalBest}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      ) : null}

                      <div className="section-title-row">
                        <div>
                          <p className="eyebrow">Friends</p>
                          <h3>Your people</h3>
                        </div>
                      </div>
                      {friends.length === 0 ? (
                        <p className="empty-copy">Once requests are accepted, your friends will show up here.</p>
                      ) : (
                        <div className="friends-list">
                          {friends.map((friend) => (
                            <article className={clsx("friend-row", selectedFriendId === friend.friendId && "selected")} key={friend.friendshipId}>
                              <div className="friend-row-main">
                                <button
                                  className="friend-select-button"
                                  onClick={() => setSelectedFriendId(friend.friendId)}
                                  type="button"
                                >
                                  {renderProfileAvatar(friend.friendName, friend.avatarUrl, "friend-avatar")}
                                  <div>
                                    <div className="friend-name-line">
                                      <strong>{friend.friendName}</strong>
                                      <span className="friend-level-badge">Lv {friend.level}</span>
                                    </div>
                                    <p className="muted friend-row-meta">Connected {prettyDate(friend.createdAt)}</p>
                                  </div>
                                </button>
                              </div>
                              <button
                                className="delete-button"
                                disabled={loading}
                                onClick={() => void handleRemoveFriend(friend.friendshipId)}
                                type="button"
                              >
                                Remove
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="friends-circle-panel">
                      <div className="section-title-row">
                        <div>
                          <p className="eyebrow">Feed</p>
                          <h3>Recent friend climbs</h3>
                        </div>
                      </div>
                      {friendFeed.length === 0 ? (
                        <p className="empty-copy">Accepted friends will start showing up here once they log climbs.</p>
                      ) : (
                        <div className="feed friend-feed">
                          {friendFeed.map((climb) => (
                            <article className="climb-card" key={climb.id}>
                              {climb.photo_url ? (
                                <button className="thumbnail-button" onClick={() => setSelectedPhotoUrl(climb.photo_url)} type="button">
                                  <img alt={`${climb.grade} climb by ${climb.friend_name}`} className="climb-photo" src={climb.photo_url} />
                                </button>
                              ) : null}
                              <div className="climb-content">
                                <div className="section-title-row">
                                  <div>
                                    <p className="eyebrow">{climb.friend_name}</p>
                                    <div className="history-title-row">
                                      <h3>
                                        {climb.grade}
                                        {climb.grade_modifier ?? ""}
                                      </h3>
                                      {climb.wall_name ? (
                                        <span className={clsx("history-description", getColorChipClass(climb.wall_name))}>{climb.wall_name}</span>
                                      ) : null}
                                    </div>
                                    <p className="muted history-meta">{prettyDate(climb.climbed_on)}</p>
                                  </div>
                                </div>
                                <div className="tag-row">
                                  {climb.flashed ? <span className="mini-badge ready">flash</span> : null}
                                  {climb.style_tags.map((tag) => (
                                    <span className="mini-badge" key={tag}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                {climb.notes ? <p>{climb.notes}</p> : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                ) : null}
              </section>
            </section>
          ) : null}

          {activeView === "progress" ? (
            <section className="progress-view">
              <section className="panel progress-hero">
                <div className="progress-hero-top">
                  <div>
                    <p className="eyebrow">{progressRange === "ALL" ? "All-time stats" : "Progress"}</p>
                    <h2>{progressStats.rangeLabel}</h2>
                    <p className="muted progress-cadence">{progressStats.cadenceLabel}</p>
                    <div className="range-chip-row" role="tablist" aria-label="Progress range">
                      {PROGRESS_RANGES.map((range) => (
                        <button
                          className={clsx("range-chip", progressRange === range && "active")}
                          key={range}
                          onClick={() => setProgressRange(range)}
                          type="button"
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="progress-kpi-grid progress-kpi-corner">
                    <article className="stat-card">
                      <span>{progressRange === "ALL" ? "Total sends" : "Sends"}</span>
                      <strong>{progressStats.sends}</strong>
                    </article>
                    <article className="stat-card">
                      <span>{progressRange === "ALL" ? "Total XP" : "XP earned"}</span>
                      <strong>{progressStats.totalXp}</strong>
                    </article>
                    <article className="stat-card">
                      <span>{progressRange === "ALL" ? "Favorite style" : "Weekly streak"}</span>
                      <strong>
                        {progressRange === "ALL"
                          ? stats.favoriteStyles[0] ?? "Still learning"
                          : `${progressStats.weeklyStreak} wk`}
                      </strong>
                    </article>
                    <article className="stat-card">
                      <span>{progressRange === "ALL" ? "Personal best" : "Consistency"}</span>
                      <strong>
                        {progressRange === "ALL"
                          ? stats.personalBest
                          : `${Math.round(progressStats.consistencyPercent)}%`}
                      </strong>
                    </article>
                  </div>
                </div>

                <div className="trend-inline-shell">
                  <div className="section-title-row trend-inline-header">
                    <div>
                      <p className="eyebrow">Trend</p>
                      <h3>Climbs over time</h3>
                    </div>
                    <span className={clsx("badge", "trend-badge", `trend-${progressStats.trendDirection}`)}>
                      {progressStats.trendDirection === "up"
                        ? "Up"
                        : progressStats.trendDirection === "down"
                          ? "Down"
                          : "Steady"}
                    </span>
                  </div>

                  <div className="trend-chart" aria-label="Climbing trend chart">
                    <div className="trend-plot">
                      <div className="trend-graph-shell">
                        <div className="trend-y-axis" aria-hidden="true">
                          {trendChart.yAxisMarks.map((mark) => (
                            <span className="trend-y-label" key={mark}>
                              {mark}
                            </span>
                          ))}
                        </div>
                        <svg aria-hidden="true" className="trend-svg" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 100 ${trendChart.height + 4}`}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="rgba(141, 185, 255, 0.34)" />
                            <stop offset="100%" stopColor="rgba(141, 185, 255, 0.03)" />
                          </linearGradient>
                        </defs>
                        {trendChart.areaPath ? <path className="trend-area" d={trendChart.areaPath} /> : null}
                        {trendChart.linePath ? <path className="trend-line" d={trendChart.linePath} /> : null}
                        {trendChart.points.map((point) => (
                          <circle
                            className="trend-point"
                            cx={point.x}
                            cy={point.y}
                            key={point.bucket.key}
                            r="1.9"
                          />
                        ))}
                        </svg>
                      </div>
                      <div className="trend-label-row">
                        {progressStats.buckets.map((bucket) => (
                          <span className="trend-label" key={bucket.key} title={`${bucket.label}: ${bucket.climbCount} climbs`}>
                            {bucket.shortLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grade-breakdown progress-grade-breakdown">
                  {CLIMB_GRADES.map((grade) => {
                    const count = selectedGradeCounts[grade] ?? 0;
                    const fillPercent = selectedGradeMax > 0 ? (count / selectedGradeMax) * 100 : 0;
                    return (
                      <div className="grade-row" key={grade}>
                        <span>{grade}</span>
                        <div className="grade-bar-track">
                          <div className="grade-bar-fill" style={{ width: `${fillPercent}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="progress-grid">
                <section className="panel">
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">Consistency</p>
                      <h2>Show-up metrics</h2>
                    </div>
                  </div>

                  <div className="progress-metric-list">
                    <div className="progress-metric">
                      <span>Active weeks</span>
                      <strong>
                        {progressStats.activeWeeks} / {progressStats.totalWeeks}
                      </strong>
                    </div>
                    <div className="progress-metric">
                      <span>Avg sends per active week</span>
                      <strong>{progressStats.averagePerActiveWeek.toFixed(1)}</strong>
                    </div>
                    <div className="progress-metric">
                      <span>Top grade</span>
                      <strong>{progressStats.topGrade}</strong>
                    </div>
                    <div className="progress-metric">
                      <span>Top styles</span>
                      <strong>{progressStats.topStyles.length > 0 ? progressStats.topStyles.join(", ") : "Still learning"}</strong>
                    </div>
                  </div>
                  <section className="flash-breakdown">
                    <div className="flash-breakdown-header">
                      <div>
                        <p className="eyebrow">Flash breakdown</p>
                        <h3>First-try sends by grade</h3>
                      </div>
                      <div className="flash-breakdown-summary">
                        <span>Average flash grade</span>
                        <strong>{progressStats.averageFlashGrade}</strong>
                      </div>
                    </div>
                    <div className="flash-overview-row">
                      <span>Overall flash rate</span>
                      <strong>{progressStats.flashRatePercent}%</strong>
                    </div>
                    <div className="flash-grade-list">
                      {progressStats.flashRateByGrade.map((item) => (
                        <div className="flash-grade-row" key={item.grade}>
                          <span>{item.grade}</span>
                          <div
                            aria-hidden="true"
                            className={clsx("flash-grade-track", item.flashRatePercent === null && "is-empty")}
                          >
                            <div
                              className="flash-grade-fill"
                              style={{ width: `${item.flashRatePercent ?? 0}%` }}
                            />
                          </div>
                          <strong className={clsx(item.flashRatePercent === null && "muted")}>
                            {item.flashRatePercent === null ? "—" : `${item.flashRatePercent}%`}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <p className="muted progress-explainer">
                    Consistency means the share of calendar weeks in this range where you logged at least one climb.
                    {` ${progressStats.activeWeeks} of ${progressStats.totalWeeks} weeks were active.`}
                  </p>
                </section>
                <section className="panel flash-panel">
                  <div className="section-title-row">
                    <div>
                      <p className="eyebrow">Flash breakdown</p>
                      <h2>First-try sends by grade</h2>
                    </div>
                  </div>
                  <section className="flash-breakdown flash-breakdown-standalone">
                    <div className="flash-breakdown-header">
                      <div className="flash-breakdown-summary-left">
                        <span>Overall flash rate</span>
                        <strong>{progressStats.flashRatePercent}%</strong>
                      </div>
                      <div className="flash-breakdown-summary">
                        <span>Average flash grade</span>
                        <strong>{progressStats.averageFlashGrade}</strong>
                      </div>
                    </div>
                    <div className="flash-grade-list">
                      {progressStats.flashRateByGrade.map((item) => (
                        <div className="flash-grade-row" key={item.grade}>
                          <span>{item.grade}</span>
                          <div
                            aria-hidden="true"
                            className={clsx("flash-grade-track", item.flashRatePercent === null && "is-empty")}
                          >
                            <div
                              className="flash-grade-fill"
                              style={{ width: `${item.flashRatePercent ?? 0}%` }}
                            />
                          </div>
                          <strong className={clsx(item.flashRatePercent === null && "muted")}>
                            {item.flashRatePercent === null ? "—" : `${item.flashRatePercent}%`}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>
              </section>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function getMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code ? `Code: ${maybeError.code}` : ""
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

function getColorChipClass(value: string) {
  const normalized = value.trim().toLowerCase();

  if (CLIMB_COLORS.includes(normalized as (typeof CLIMB_COLORS)[number])) {
    return `history-color-chip history-color-${normalized}`;
  }

  return "";
}

function initialsForName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function renderProfileAvatar(name: string, avatarUrl: string | null | undefined, className: string) {
  if (avatarUrl) {
    return <img alt={`${name} profile`} className={clsx(className, "profile-avatar-image")} src={avatarUrl} />;
  }

  return <div className={className}>{initialsForName(name)}</div>;
}
