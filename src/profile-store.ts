// Durable user-profile store — persisted via the toolkit's Redis-backed storage.
// Key scheme: `profile:{userId}` → UserProfile JSON.
// No keyspace scans; reads go through the user's own key.

import type { StorageAdapter } from "grammy";
import { resolveSessionStorage } from "./toolkit/session/redis.js";

export interface UserProfile {
  userId: number;
  name: string;
  learningLevel: "beginner" | "intermediate" | "advanced";
  preferredTopics: string[];
  correctionMode: "detailed" | "concise";
  reminderEnabled: boolean;
  sessionCount: number;
  currentStreak: number;
  lastPracticeDate: string | null; // ISO date string YYYY-MM-DD
}

const DEFAULT_PROFILE: UserProfile = {
  userId: 0,
  name: "",
  learningLevel: "beginner",
  preferredTopics: [],
  correctionMode: "detailed",
  reminderEnabled: false,
  sessionCount: 0,
  currentStreak: 0,
  lastPracticeDate: null,
};

let storage: StorageAdapter<UserProfile>;

export function initProfileStore(
  explicit?: StorageAdapter<UserProfile>,
): void {
  storage = resolveSessionStorage<UserProfile>(explicit);
}

function key(userId: number): string {
  return `profile:${userId}`;
}

export async function getProfile(userId: number): Promise<UserProfile | undefined> {
  return storage.read(key(userId));
}

export async function upsertProfile(
  userId: number,
  data: Partial<UserProfile>,
): Promise<UserProfile> {
  const existing = await storage.read(key(userId));
  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    ...existing,
    ...data,
    userId,
  };
  await storage.write(key(userId), profile);
  return profile;
}

export async function updateProfile(
  userId: number,
  data: Partial<UserProfile>,
): Promise<UserProfile> {
  const existing = await storage.read(key(userId));
  if (!existing) return upsertProfile(userId, data);
  const profile = { ...existing, ...data };
  await storage.write(key(userId), profile);
  return profile;
}

export async function incrementSessionCount(userId: number): Promise<void> {
  const profile = await storage.read(key(userId));
  if (!profile) return;
  profile.sessionCount += 1;
  await storage.write(key(userId), profile);
}

export async function updateStreak(
  userId: number,
  today: string,
): Promise<void> {
  const profile = await storage.read(key(userId));
  if (!profile) return;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (profile.lastPracticeDate === today) {
    // Already counted today — no-op.
    return;
  } else if (profile.lastPracticeDate === yesterdayStr) {
    // Consecutive day — increment streak.
    profile.currentStreak += 1;
  } else {
    // Streak broken — reset to 1.
    profile.currentStreak = 1;
  }
  profile.lastPracticeDate = today;
  await storage.write(key(userId), profile);
}
