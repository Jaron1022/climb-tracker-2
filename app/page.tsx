"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { EMBLEM_DEFINITIONS, getUnlockedEmblems, normalizeSelectedEmblems } from "@/lib/emblems";
import { APP_THEMES, normalizeSelectedTheme } from "@/lib/themes";
import { CLIMB_COLORS, CLIMB_GRADES, DEFAULT_FORM, STYLE_TAG_GROUPS, climbToXp, gradeToXp } from "@/lib/xp";
import { uploadPhoto } from "@/lib/local-store";
import {
  buildLeaderboardScore,
  getLeaderboardScoreBreakdown,
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
  requestPasswordReset,
  saveClimbForUser,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  subscribeToAuthChanges,
  updatePassword,
  updateProfileAvatar,
  updateSelectedEmblems,
  updateSelectedTheme,
  updateDisplayName,
  updateClimbForUser
} from "@/lib/supabase-store";
import type {
  ClimbInsert,
  ClimbRow,
  FriendFeedClimb,
  FriendSummary,
  Grade,
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
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [confirmResetPasswordValue, setConfirmResetPasswordValue] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [activeView, setActiveView] = useState<"home" | "history" | "friends" | "account" | "progress">("home");
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
  const [activeAction, setActiveAction] = useState<"auth" | "rename" | "avatar" | "emblems" | "theme" | "logout" | "account-delete" | "password-reset" | "password-update" | "climb" | "edit" | "load" | "delete" | "">("");
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [climbPendingDelete, setClimbPendingDelete] = useState<ClimbRow | null>(null);
  const [editingClimb, setEditingClimb] = useState<ClimbRow | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showSaveBurst, setShowSaveBurst] = useState(false);
  const [isXpInfoOpen, setIsXpInfoOpen] = useState(false);
  const [isEmblemPickerOpen, setIsEmblemPickerOpen] = useState(false);
  const [selectedEmblemDraft, setSelectedEmblemDraft] = useState<string[]>([]);
  const [selectedThemeDraft, setSelectedThemeDraft] = useState("sky");
  const [historyGradeFilter, setHistoryGradeFilter] = useState<"All" | ClimbRow["grade"]>("All");
  const [historyTagQuery, setHistoryTagQuery] = useState("");
  const [historyVisibleCount, setHistoryVisibleCount] = useState(20);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<ProfileSearchRow[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [friendFeed, setFriendFeed] = useState<FriendFeedClimb[]>([]);
  const [friendFeedVisibleCount, setFriendFeedVisibleCount] = useState(20);
  const [pendingOutgoingFriendIds, setPendingOutgoingFriendIds] = useState<string[]>([]);
  const [friendsTab, setFriendsTab] = useState<"discover" | "requests" | "circle" | "leaderboard">("circle");
  const [expandedLeaderboardId, setExpandedLeaderboardId] = useState("");
  const [progressRange, setProgressRange] = useState<ProgressRange>("ALL");
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);

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

    const unsubscribe = subscribeToAuthChanges((user, event) => {
      setCurrentUserEmail(user?.email ?? "");
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
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
    setFriendFeedVisibleCount(20);
  }, [friendFeed]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccess("");
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (friends.length === 0) {
      setSelectedFriendId("");
      return;
    }

    if (!friends.some((friend) => friend.friendId === selectedFriendId)) {
      setSelectedFriendId("");
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    setSelectedThemeDraft(normalizeSelectedTheme(activeProfile?.selected_theme));
  }, [activeProfile?.selected_theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(orientation: landscape) and (max-width: 960px) and (max-height: 640px)");
    const syncLandscapeState = () => setIsLandscapePhone(mediaQuery.matches);

    syncLandscapeState();
    mediaQuery.addEventListener("change", syncLandscapeState);
    window.addEventListener("resize", syncLandscapeState);

    return () => {
      mediaQuery.removeEventListener("change", syncLandscapeState);
      window.removeEventListener("resize", syncLandscapeState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    setIsRecoveryMode(hash.includes("type=recovery") || search.includes("type=recovery"));
  }, []);

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

  async function handlePasswordResetRequest(prefilledEmail?: string) {
    const targetEmail = (prefilledEmail ?? email).trim();

    if (!targetEmail) {
      setError("Add your email first so I know where to send the reset link.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("password-reset");
      setError("");
      setSuccess("");
      await requestPasswordReset(targetEmail, window.location.origin);
      setSuccess(`Password reset email sent to ${targetEmail}.`);
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetPasswordValue.trim()) {
      setError("Add a new password first.");
      setSuccess("");
      return;
    }

    if (resetPasswordValue.length < 6) {
      setError("Use at least 6 characters for your new password.");
      setSuccess("");
      return;
    }

    if (resetPasswordValue !== confirmResetPasswordValue) {
      setError("Your passwords do not match yet.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setActiveAction("password-update");
      setError("");
      setSuccess("");
      await updatePassword(resetPasswordValue);
      setResetPasswordValue("");
      setConfirmResetPasswordValue("");
      setIsRecoveryMode(false);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setSuccess("Password updated. You can sign in with your new password now.");
    } catch (err) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  function openEmblemPicker() {
    setSelectedEmblemDraft(selectedEmblems);
    setIsEmblemPickerOpen(true);
  }

  function toggleEmblemSelection(emblemId: string, isUnlocked: boolean) {
    if (!isUnlocked) {
      return;
    }

    setSelectedEmblemDraft((current) => {
      if (current.includes(emblemId)) {
        return current.filter((id) => id !== emblemId);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, emblemId];
    });
  }

  function removeDraftEmblem(emblemId: string) {
    setSelectedEmblemDraft((current) => current.filter((id) => id !== emblemId));
  }

  async function handleSaveEmblems() {
    if (!activeProfileId) {
      return;
    }

    try {
      setLoading(true);
      setActiveAction("emblems");
      setError("");
      setSuccess("");
      const updatedProfile = await updateSelectedEmblems(activeProfileId, selectedEmblemDraft);
      setActiveProfile(updatedProfile);
      setIsEmblemPickerOpen(false);
      setSuccess("Emblems updated.");
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

  async function handleThemeSave() {
    if (!activeProfileId) {
      return;
    }

    try {
      setLoading(true);
      setActiveAction("theme");
      setError("");
      setSuccess("");
      const updatedProfile = await updateSelectedTheme(activeProfileId, selectedThemeDraft);
      setActiveProfile(updatedProfile);
      setSuccess("Theme updated.");
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
  const unlockedEmblems = useMemo(() => getUnlockedEmblems(climbs), [climbs]);
  const unlockedEmblemIds = useMemo(() => unlockedEmblems.map((emblem) => emblem.id), [unlockedEmblems]);
  const lockedEmblems = useMemo(
    () => EMBLEM_DEFINITIONS.filter((emblem) => !unlockedEmblemIds.includes(emblem.id)),
    [unlockedEmblemIds]
  );
  const selectedEmblems = useMemo(
    () => normalizeSelectedEmblems(activeProfile?.selected_emblems ?? [], unlockedEmblemIds),
    [activeProfile?.selected_emblems, unlockedEmblemIds]
  );
  const selectedTheme = useMemo(() => normalizeSelectedTheme(activeProfile?.selected_theme), [activeProfile?.selected_theme]);
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.friendId === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );
  const leaderboardEntries = useMemo(() => {
    const recentClimbs = climbs.filter((climb) => {
      const climbedOn = new Date(`${climb.climbed_on}T00:00:00`);
      const threshold = new Date();
      threshold.setHours(0, 0, 0, 0);
      threshold.setDate(threshold.getDate() - 6);
      return climbedOn >= threshold;
    });
    const activeDays7 = new Set(recentClimbs.map((climb) => climb.climbed_on)).size;
    const selfEntry = activeProfile
      ? {
          id: activeProfile.id,
          name: activeProfile.display_name,
          avatarUrl: activeProfile.avatar_url,
          selectedEmblems,
          level: stats.level,
          personalBest: stats.personalBest as Grade,
          recentSends7: recentClimbs.length,
          activeDays7,
          score: buildLeaderboardScore(stats.level, stats.personalBest as Grade, recentClimbs.length, activeDays7),
          breakdown: getLeaderboardScoreBreakdown(stats.level, stats.personalBest as Grade, recentClimbs.length, activeDays7),
          isYou: true
        }
      : null;

    const friendEntries = friends.map((friend) => ({
      id: friend.friendId,
      name: friend.friendName,
      avatarUrl: friend.avatarUrl,
      selectedEmblems: friend.selectedEmblems,
      level: friend.level,
      personalBest: friend.personalBest,
      recentSends7: friend.recentSends7,
      activeDays7: friend.activeDays7,
      score: friend.leaderboardScore,
      breakdown: friend.leaderboardBreakdown,
      isYou: false
    }));

    return [selfEntry, ...friendEntries]
      .filter((entry): entry is NonNullable<typeof selfEntry> => Boolean(entry))
      .sort((left, right) => right.score - left.score || right.level - left.level || left.name.localeCompare(right.name));
  }, [activeProfile, climbs, friends, selectedEmblems, stats.level, stats.personalBest]);
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
  const visibleHistoryClimbs = filteredClimbs.slice(0, historyVisibleCount);
  const hasMoreHistory = filteredClimbs.length > historyVisibleCount;
  const visibleFriendFeed = friendFeed.slice(0, friendFeedVisibleCount);
  const hasMoreFriendFeed = friendFeed.length > friendFeedVisibleCount;
  const canSaveClimb = Boolean(activeProfileId) && !loading && !booting;
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
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    }
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
      setSelectedFriendId("");
      await refreshFriendsView();
      setSuccess("Friend removed.");
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
    <>
      {isLandscapePhone ? (
        <section className="orientation-lock-screen" role="dialog" aria-live="polite" aria-label="Rotate device to continue">
          <div className="orientation-lock-card">
            <div className="orientation-lock-icon" aria-hidden="true">
              <span className="orientation-lock-phone" />
            </div>
            <p className="eyebrow">Portrait only</p>
            <h1>Rotate your phone back upright</h1>
            <p className="muted">This app is set up for portrait use so the dashboard and climb form stay easy to read.</p>
          </div>
          </section>
        ) : null}
      {isXpInfoOpen ? (
        <section className="lightbox xp-info-overlay" aria-label="XP breakdown" role="dialog">
          <div className="panel xp-info-modal">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">XP breakdown</p>
                <h2>How climb XP works</h2>
              </div>
              <button className="secondary-button xp-info-close" onClick={() => setIsXpInfoOpen(false)} type="button">
                Close
              </button>
            </div>
            <div className="xp-info-grid">
              {CLIMB_GRADES.map((grade) => (
                <div className="xp-info-row" key={grade}>
                  <span>{grade}</span>
                  <strong>{gradeToXp(grade)} XP</strong>
                </div>
              ))}
            </div>
            <div className="xp-info-modifiers">
              <div className="xp-info-row">
                <span>`-` modifier</span>
                <strong>x0.85</strong>
              </div>
              <div className="xp-info-row">
                <span>`+` modifier</span>
                <strong>x1.15</strong>
              </div>
              <div className="xp-info-row">
                <span>Flash bonus</span>
                <strong>x1.35</strong>
              </div>
            </div>
            <p className="muted xp-info-note">Final climb XP uses the base grade first, then applies `-` or `+`, then the flash bonus if it was first try.</p>
          </div>
        </section>
      ) : null}
      {isEmblemPickerOpen ? (
        <section className="lightbox emblem-picker-overlay" aria-label="Select emblems" role="dialog">
          <div className="panel emblem-picker-modal">
            <div className="emblem-picker-static">
              <div className="emblem-picker-handle" aria-hidden="true" />
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Select emblems</p>
                  <h2>Your badge loadout</h2>
                </div>
                <button className="secondary-button emblem-picker-close" onClick={() => setIsEmblemPickerOpen(false)} type="button">
                  Close
                </button>
              </div>
              <p className="muted emblem-picker-copy">Choose up to 3 emblems to show on your profile. Unlocked emblems reflect your climbing milestones.</p>
              <div className="emblem-selected-row">
                {[0, 1, 2].map((slot) => {
                  const emblemId = selectedEmblemDraft[slot];
                  const emblem = EMBLEM_DEFINITIONS.find((item) => item.id === emblemId);

                  return (
                    <div className="emblem-selected-slot" key={slot}>
                      {emblem ? (
                        <button
                          className="emblem-selected-button"
                          onClick={() => removeDraftEmblem(emblem.id)}
                          type="button"
                        >
                          {renderEmblemBadge(emblem.id, "large")}
                        </button>
                      ) : (
                        <span className="muted">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="emblem-picker-scroll">
              <section className="emblem-section">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Unlocked</p>
                    <h3>Your earned emblems</h3>
                  </div>
                </div>
                <div className="emblem-grid">
                  {unlockedEmblems.map((emblem) => {
                    const isSelected = selectedEmblemDraft.includes(emblem.id);

                    return (
                      <button
                        className={clsx("emblem-card", isSelected && "selected")}
                        key={emblem.id}
                        onClick={() => toggleEmblemSelection(emblem.id, true)}
                        type="button"
                      >
                        {renderEmblemBadge(emblem.id, "large")}
                        <strong>{emblem.name}</strong>
                        <span>{emblem.description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="emblem-section">
                <div className="section-title-row">
                  <div>
                    <p className="eyebrow">Locked</p>
                    <h3>More to earn</h3>
                  </div>
                </div>
                <div className="emblem-grid">
                  {lockedEmblems.map((emblem) => (
                    <div className={clsx("emblem-card", "locked")} key={emblem.id}>
                      {renderEmblemBadge(emblem.id, "large")}
                      <strong>{emblem.name}</strong>
                      <span>{emblem.description}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="confirm-actions emblem-picker-actions">
              <button className="secondary-button" onClick={() => setSelectedEmblemDraft([])} type="button">
                Clear all
              </button>
              <button className="primary-button" disabled={loading} onClick={() => void handleSaveEmblems()} type="button">
                {activeAction === "emblems" ? "Saving..." : "Save emblems"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {selectedFriend ? (
        <section className="lightbox friend-profile-overlay" aria-label={`${selectedFriend.friendName} profile`} role="dialog">
          <div className="panel friend-profile-modal">
            <button className="lightbox-close" onClick={() => setSelectedFriendId("")} type="button">
              Close
            </button>
            <div className="friend-profile-header">
              {renderProfileAvatar(
                selectedFriend.friendName,
                selectedFriend.avatarUrl,
                selectedFriend.selectedEmblems,
                "account-avatar account-avatar-large friend-profile-avatar"
              )}
              <div className="friend-profile-copy">
                <p className="eyebrow">Climber profile</p>
                <h2>{selectedFriend.friendName}</h2>
                <p className="muted">Connected {prettyDate(selectedFriend.createdAt)}</p>
              </div>
            </div>

            <div className="friend-profile-stats">
              <div className="friend-profile-stat">
                <span>Level</span>
                <strong>{selectedFriend.level}</strong>
              </div>
              <div className="friend-profile-stat">
                <span>Total sends</span>
                <strong>{selectedFriend.totalSends}</strong>
              </div>
              <div className="friend-profile-stat">
                <span>Personal best</span>
                <strong>{selectedFriend.personalBest}</strong>
              </div>
              <div className="friend-profile-stat">
                <span>7d active days</span>
                <strong>{selectedFriend.activeDays7}</strong>
              </div>
            </div>

            <section className="friend-profile-emblems">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Selected emblems</p>
                  <h3>Badge showcase</h3>
                </div>
              </div>
              {selectedFriend.selectedEmblems.length > 0 ? (
                <div className="friend-emblem-breakdown">
                  {selectedFriend.selectedEmblems.map((emblemId) => {
                    const emblem = EMBLEM_DEFINITIONS.find((item) => item.id === emblemId);

                    if (!emblem) {
                      return null;
                    }

                    return (
                      <article className="friend-emblem-card" key={emblem.id}>
                        {renderEmblemBadge(emblem.id, "large")}
                        <div>
                          <strong>{emblem.name}</strong>
                          <p className="muted">{emblem.description}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-copy">No emblems selected yet.</p>
              )}
            </section>

            <div className="friend-profile-actions">
              <button
                className="delete-button"
                disabled={loading}
                onClick={() => void handleRemoveFriend(selectedFriend.friendshipId)}
                type="button"
              >
                Remove friend
              </button>
            </div>
          </div>
        </section>
      ) : null}
      <main className="shell shell-dashboard" data-app-theme={selectedTheme}>
      {error ? (
        <section className="message error status-banner">
          <strong>Something needs attention:</strong> {error}
        </section>
      ) : null}

        {success ? <section className="message success status-banner">{success}</section> : null}

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
      ) : isRecoveryMode ? (
        <section className="panel onboarding-panel">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Reset password</p>
              <h1>Choose a new password</h1>
            </div>
          </div>
          <p className="muted helper-copy">You came back from a Supabase recovery link. Set your new password here and then jump back into the app.</p>
          <form className="stack-sm" onSubmit={handlePasswordUpdate}>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={resetPasswordValue}
                onChange={(event) => setResetPasswordValue(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                placeholder="Repeat your new password"
                value={confirmResetPasswordValue}
                onChange={(event) => setConfirmResetPasswordValue(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={loading} type="submit">
              {activeAction === "password-update" ? "Saving new password..." : "Update password"}
            </button>
          </form>
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
            {authMode === "signin" ? (
              <button
                className="text-button"
                disabled={loading}
                onClick={() => void handlePasswordResetRequest()}
                type="button"
              >
                {activeAction === "password-reset" ? "Sending reset email..." : "Forgot password?"}
              </button>
            ) : null}
          </form>
        </section>
      ) : (
        <>
          <header className="app-header">
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
                    <div className="xp-info-row-header">
                      <span className="muted">XP rules</span>
                      <button className="icon-info-button" onClick={() => setIsXpInfoOpen(true)} type="button">
                        i
                      </button>
                    </div>
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
                    {renderProfileAvatar(activeProfile.display_name, activeProfile.avatar_url, selectedEmblems, "account-avatar account-avatar-large")}
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
                      <button className="secondary-button" disabled={loading} onClick={openEmblemPicker} type="button">
                        Choose emblems
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
                    <p className="eyebrow">Theme</p>
                    <h2>Customize app color</h2>
                  </div>
                </div>
                <p className="muted">Pick a color accent for your app. Your choice saves to your account.</p>
                <div className="theme-swatch-row" role="list" aria-label="App theme colors">
                  {APP_THEMES.map((theme) => (
                    <button
                      aria-label={`Select ${theme.id} theme`}
                      className={clsx("theme-swatch", selectedThemeDraft === theme.id && "selected")}
                      key={theme.id}
                      onClick={() => setSelectedThemeDraft(theme.id)}
                      style={{ "--swatch-color": theme.hex } as React.CSSProperties}
                      type="button"
                    />
                  ))}
                </div>
                <div className="account-theme-actions">
                  <button className="secondary-button" onClick={() => setSelectedThemeDraft("sky")} type="button">
                    Reset
                  </button>
                  <button className="primary-button" disabled={loading} onClick={() => void handleThemeSave()} type="button">
                    {activeAction === "theme" ? "Saving..." : "Save theme"}
                  </button>
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
                    <button className="secondary-button" disabled={loading} onClick={() => void handlePasswordResetRequest(currentUserEmail)} type="button">
                      {activeAction === "password-reset" ? "Sending reset email..." : "Reset password"}
                    </button>
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
                    <h2>
                      {friendsTab === "discover"
                        ? "Find climbers"
                        : friendsTab === "requests"
                          ? "Requests"
                          : friendsTab === "leaderboard"
                            ? "Leaderboard"
                            : "Your circle"}
                    </h2>
                  </div>
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
                  <button className={clsx("friends-tab", friendsTab === "leaderboard" && "active")} onClick={() => setFriendsTab("leaderboard")} type="button">
                    Leaderboard
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
                                {renderProfileAvatar(result.display_name, result.avatar_url, result.selected_emblems, "friend-avatar")}
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
                              {renderProfileAvatar(request.requesterName, request.requesterAvatarUrl, request.requesterSelectedEmblems, "friend-avatar")}
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

                {friendsTab === "leaderboard" ? (
                  <div className="friends-tab-panel">
                    <section className="panel leaderboard-panel">
                      <div className="section-title-row">
                        <div>
                          <p className="eyebrow">Leaderboard</p>
                          <h3>Circle standings</h3>
                        </div>
                      </div>
                      <p className="muted friends-section-copy">Balanced around this week so recent climbing matters more than old volume.</p>
                      <div className="leaderboard-list">
                        {leaderboardEntries.map((entry, index) => {
                          const isExpanded = expandedLeaderboardId === entry.id;
                          return (
                            <article className={clsx("leaderboard-row", entry.isYou && "you", isExpanded && "expanded")} key={entry.id}>
                              <button
                                className="leaderboard-main"
                                onClick={() => setExpandedLeaderboardId((current) => (current === entry.id ? "" : entry.id))}
                                type="button"
                              >
                                <div className="leaderboard-rank">{index + 1}</div>
                                {renderProfileAvatar(entry.name, entry.avatarUrl, entry.selectedEmblems, "friend-avatar")}
                                <div className="leaderboard-copy">
                                  <div className="friend-name-line">
                                    <strong>{entry.name}</strong>
                                    {entry.isYou ? <span className="mini-badge ready">You</span> : null}
                                  </div>
                                  <p className="muted friend-row-meta">
                                    Lv {entry.level} | PB {entry.personalBest} | {entry.recentSends7} sends in 7d
                                  </p>
                                </div>
                                <div className="leaderboard-score">
                                  <strong>{entry.score}</strong>
                                  <span>{isExpanded ? "hide" : "score"}</span>
                                </div>
                              </button>
                              {isExpanded ? (
                                <div className="leaderboard-breakdown">
                                  <div className="leaderboard-breakdown-row">
                                    <span>Level ({entry.level} x 8)</span>
                                    <strong>{entry.breakdown.levelPoints}</strong>
                                  </div>
                                  <div className="leaderboard-breakdown-row">
                                    <span>Personal best ({entry.personalBest})</span>
                                    <strong>{entry.breakdown.personalBestPoints}</strong>
                                  </div>
                                  <div className="leaderboard-breakdown-row">
                                    <span>Recent sends (max 10 this week)</span>
                                    <strong>{entry.breakdown.recentSendsPoints}</strong>
                                  </div>
                                  <div className="leaderboard-breakdown-row">
                                    <span>Active days (max 7 this week)</span>
                                    <strong>{entry.breakdown.activeDaysPoints}</strong>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                ) : null}

                {friendsTab === "circle" ? (
                  <div className="friends-tab-panel friends-circle-layout">
                    <section className="friends-circle-panel">
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
                              <div className="friend-row-stack">
                                  <button
                                    className="friend-select-button"
                                    onClick={() => setSelectedFriendId(friend.friendId)}
                                    type="button"
                                  >
                                  {renderProfileAvatar(friend.friendName, friend.avatarUrl, friend.selectedEmblems, "friend-avatar")}
                                  <div>
                                    <div className="friend-name-line">
                                      <strong>{friend.friendName}</strong>
                                      <span className="friend-level-badge">Lv {friend.level}</span>
                                    </div>
                                    <p className="muted friend-row-meta">Connected {prettyDate(friend.createdAt)}</p>
                                  </div>
                                  <span className={clsx("friend-row-chevron", selectedFriendId === friend.friendId && "expanded")} aria-hidden="true">
                                    {selectedFriendId === friend.friendId ? "⌃" : "›"}
                                  </span>
                                </button>
                                </div>
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
                        <>
                          <div className="feed friend-feed">
                            {visibleFriendFeed.map((climb) => (
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
                          {hasMoreFriendFeed ? (
                            <div className="history-footer">
                              <button className="secondary-button" onClick={() => setFriendFeedVisibleCount((current) => current + 20)} type="button">
                                Load 20 more
                              </button>
                            </div>
                          ) : null}
                        </>
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

          <nav className="bottom-nav" aria-label="Primary navigation">
              {[
                { key: "home", label: "Dashboard", shortLabel: "Home" },
                { key: "history", label: "History", shortLabel: "History" },
                { key: "progress", label: "Progress", shortLabel: "Progress" },
                { key: "friends", label: "Friends", shortLabel: "Friends" },
                { key: "account", label: "Account", shortLabel: "Account" }
              ].map((item) => (
              <button
                key={item.key}
                className={clsx("bottom-nav-link", activeView === item.key && "active")}
                onClick={() => selectView(item.key as "home" | "history" | "friends" | "progress" | "account")}
                type="button"
              >
                {renderNavIcon(item.key)}
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      </main>
    </>
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

function renderProfileAvatar(
  name: string,
  avatarUrl: string | null | undefined,
  selectedEmblems: string[] | null | undefined,
  className: string
) {
  const normalizedEmblems = (selectedEmblems ?? []).slice(0, 3);

  return (
    <div className="profile-avatar-wrap">
      {avatarUrl ? (
        <img alt={`${name} profile`} className={clsx(className, "profile-avatar-image")} src={avatarUrl} />
      ) : (
        <div className={className}>{initialsForName(name)}</div>
      )}
      {normalizedEmblems.length > 0 ? (
        <div className="profile-emblem-row">
          {normalizedEmblems.map((emblemId) => renderEmblemBadge(emblemId, "small"))}
        </div>
      ) : null}
    </div>
  );
}

function renderEmblemBadge(emblemId: string, size: "small" | "large") {
  const emblem = EMBLEM_DEFINITIONS.find((item) => item.id === emblemId);

  if (!emblem) {
    return null;
  }

  return (
    <div
      className={clsx(
        "emblem-badge",
        `emblem-tone-${emblem.tone}`,
        `emblem-family-${emblem.family}`,
        `emblem-tier-${emblem.tier}`,
        size === "small" ? "small" : "large"
      )}
      key={`${emblem.id}-${size}`}
    >
      <div className="emblem-inner">{renderEmblemIcon(emblem.icon)}</div>
    </div>
  );
}

function renderEmblemIcon(icon: string) {
  switch (icon) {
    case "flag":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M7 20V5m0 0h10l-2 3 2 3H7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "bolt":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m13 2-7 11h5l-1 9 8-12h-5l1-8Z" fill="currentColor" />
        </svg>
      );
    case "stack":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m12 4 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4M4 16l8 4 8-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "crown":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m4 18 2-10 6 5 6-5 2 10H4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M9 18h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "medal":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M9 3h6l-1 5h-4L9 3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
          <circle cx="12" cy="15" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "peak":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m3 19 6-8 3 4 4-7 5 11H3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "star":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m12 3 2.7 5.5 6.1.9-4.4 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9L12 3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M12 3 5 6v6c0 4.3 2.7 7.7 7 9 4.3-1.3 7-4.7 7-9V6l-7-3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "triangle":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m12 5 7 13H5l7-13Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "roof":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M4 16h10l6-8H10L4 16Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "diamond":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m12 3 8 9-8 9-8-9 8-9Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "ring":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "arrow-up":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M12 19V6m0 0-5 5m5-5 5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "comet":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <circle cx="15" cy="9" r="3" fill="currentColor" />
          <path d="M5 19 12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M8 20 4 20M6 16l-2 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "plus":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "spark":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <path d="m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "calendar":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <rect x="4" y="6" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 3v6M16 3v6M4 10h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      );
    case "compass":
      return (
        <svg aria-hidden="true" className="emblem-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m10 14 1-4 4-1-1 4-4 1Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
}

function renderNavIcon(view: string) {
  switch (view) {
    case "home":
      return (
        <svg aria-hidden="true" className="bottom-nav-icon" viewBox="0 0 24 24">
          <path d="M4 10.5 12 4l8 6.5v8a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case "history":
      return (
        <svg aria-hidden="true" className="bottom-nav-icon" viewBox="0 0 24 24">
          <path d="M6 7h12M6 12h12M6 17h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      );
    case "friends":
      return (
        <svg aria-hidden="true" className="bottom-nav-icon" viewBox="0 0 24 24">
          <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4.5 19a4.5 4.5 0 0 1 7 0M13 19a3.8 3.8 0 0 1 6 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case "progress":
      return (
        <svg aria-hidden="true" className="bottom-nav-icon" viewBox="0 0 24 24">
          <path d="M5 16.5 9.5 12l3 3 6.5-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M5 5v14h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
    case "account":
      return (
        <svg aria-hidden="true" className="bottom-nav-icon" viewBox="0 0 24 24">
          <path d="M12 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 3.5 1 .8 1.3-.3.5 1.2 1.3.5-.3 1.3.8 1-.8 1 .3 1.3-1.3.5-.5 1.2-1.3-.3-1 .8-1-.8-1.3.3-.5-1.2-1.3-.5.3-1.3-.8-1 .8-1-.3-1.3 1.3-.5.5-1.2 1.3.3z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
      );
    default:
      return null;
  }
}



