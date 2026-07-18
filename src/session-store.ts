// Durable conversation / correction store — persisted via the toolkit's
// Redis-backed storage.
//
// Key scheme (no keyspace scans):
//   conversation:{sessionId}  → ConversationSession
//   correction:{correctionId} → CorrectionItem
//   user_sessions:{userId}    → string[] (session-id index)

import type { StorageAdapter } from "grammy";
import { resolveSessionStorage } from "./toolkit/session/redis.js";

export interface CorrectionItem {
  correctionId: string;
  sessionId: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  example: string;
  timestamp: number;
}

export interface ConversationSession {
  sessionId: string;
  userId: number;
  mode: "free_chat" | "guided";
  topic: string;
  messages: Array<{ role: "user" | "bot"; text: string }>;
  corrections: string[]; // correctionIds
  timestamp: number;
}

export interface GuidedExercise {
  exerciseId: string;
  topic: string;
  prompt: string;
  targetStructures: string[];
  feedbackTemplates: string[];
}

let sessionStorage: StorageAdapter<ConversationSession>;
let correctionStorage: StorageAdapter<CorrectionItem>;
let indexStorage: StorageAdapter<string[]>;

export function initSessionStore(
  sessionAdp?: StorageAdapter<ConversationSession>,
  correctionAdp?: StorageAdapter<CorrectionItem>,
  indexAdp?: StorageAdapter<string[]>,
): void {
  sessionStorage = resolveSessionStorage<ConversationSession>(sessionAdp);
  correctionStorage = resolveSessionStorage<CorrectionItem>(correctionAdp);
  indexStorage = resolveSessionStorage<string[]>(indexAdp);
}

function sessionKey(id: string): string {
  return `conversation:${id}`;
}
function correctionKey(id: string): string {
  return `correction:${id}`;
}
function indexKey(userId: number): string {
  return `user_sessions:${userId}`;
}

export async function saveSession(session: ConversationSession): Promise<void> {
  await sessionStorage.write(sessionKey(session.sessionId), session);
  // Update user's session index
  const existing = await indexStorage.read(indexKey(session.userId)) ?? [];
  if (!existing.includes(session.sessionId)) {
    existing.push(session.sessionId);
    await indexStorage.write(indexKey(session.userId), existing);
  }
}

export async function getSession(
  sessionId: string,
): Promise<ConversationSession | undefined> {
  return sessionStorage.read(sessionKey(sessionId));
}

export async function getUserSessions(
  userId: number,
): Promise<ConversationSession[]> {
  const ids = await indexStorage.read(indexKey(userId)) ?? [];
  const sessions: ConversationSession[] = [];
  for (const id of ids) {
    const s = await sessionStorage.read(sessionKey(id));
    if (s) sessions.push(s);
  }
  return sessions;
}

export async function saveCorrection(correction: CorrectionItem): Promise<void> {
  await correctionStorage.write(correctionKey(correction.correctionId), correction);
  // Link to session
  const session = await sessionStorage.read(sessionKey(correction.sessionId));
  if (session) {
    if (!session.corrections.includes(correction.correctionId)) {
      session.corrections.push(correction.correctionId);
      await sessionStorage.write(sessionKey(session.sessionId), session);
    }
  }
}

export async function getCorrection(
  correctionId: string,
): Promise<CorrectionItem | undefined> {
  return correctionStorage.read(correctionKey(correctionId));
}

export async function getSessionCorrections(
  sessionId: string,
): Promise<CorrectionItem[]> {
  const session = await sessionStorage.read(sessionKey(sessionId));
  if (!session) return [];
  const corrections: CorrectionItem[] = [];
  for (const id of session.corrections) {
    const c = await correctionStorage.read(correctionKey(id));
    if (c) corrections.push(c);
  }
  return corrections;
}

export async function getAllUserCorrections(
  userId: number,
): Promise<CorrectionItem[]> {
  const sessions = await getUserSessions(userId);
  const corrections: CorrectionItem[] = [];
  for (const s of sessions) {
    for (const id of s.corrections) {
      const c = await correctionStorage.read(correctionKey(id));
      if (c) corrections.push(c);
    }
  }
  return corrections;
}

/** Pre-defined guided exercises indexed by topic. */
export const EXERCISES: Record<string, GuidedExercise[]> = {
  grammar: [
    {
      exerciseId: "grammar:present_simple",
      topic: "grammar",
      prompt: "Write 3 sentences about your daily routine using the present simple tense.",
      targetStructures: ["I wake up", "I eat", "I go"],
      feedbackTemplates: [
        "Nice use of present simple! Your routine is clear.",
        "Good effort! Remember to use base verbs after 'I' — no '-s' ending needed.",
      ],
    },
    {
      exerciseId: "grammar:past_simple",
      topic: "grammar",
      prompt: "Describe what you did last weekend using the past simple tense.",
      targetStructures: ["I went", "I visited", "I watched"],
      feedbackTemplates: [
        "Great past tense usage! Your weekend sounds fun.",
        "Watch out for irregular past forms — 'go' becomes 'went', not 'goed'.",
      ],
    },
  ],
  vocabulary: [
    {
      exerciseId: "vocab:describe_picture",
      topic: "vocabulary",
      prompt: "Describe a place you love using at least 5 different adjectives.",
      targetStructures: ["beautiful", "quiet", "peaceful", "lovely", "amazing"],
      feedbackTemplates: [
        "Wonderful vocabulary! Those adjectives paint a vivid picture.",
        "Good range of adjectives! Try adding sensory details next time.",
      ],
    },
  ],
  conversation: [
    {
      exerciseId: "conv:make_plan",
      topic: "conversation",
      prompt: "You're making plans with a friend. Write what you would say to suggest meeting for coffee tomorrow at 3pm.",
      targetStructures: ["Would you like to", "How about", "Let's meet"],
      feedbackTemplates: [
        "Natural suggestion! That sounds like a great plan.",
        "Good attempt! 'Shall we' or 'Would you like to' are polite ways to suggest plans.",
      ],
    },
  ],
  pronunciation: [
    {
      exerciseId: "pron:read_aloud",
      topic: "pronunciation",
      prompt: "Read this sentence aloud and type it: 'The weather is absolutely beautiful today, isn't it?'",
      targetStructures: ["weather", "beautiful", "absolutely"],
      feedbackTemplates: [
        "Perfect transcription! Your reading comprehension is strong.",
        "Almost there! Focus on the stress in 'beautiful' — BEAU-ti-ful.",
      ],
    },
  ],
};

let exerciseCounter = 0;

export function generateSessionId(): string {
  exerciseCounter += 1;
  return `ses_${Date.now()}_${exerciseCounter}`;
}

export function generateCorrectionId(): string {
  return `cor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
