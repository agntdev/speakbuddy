import { Composer } from "grammy";
import { readdirSync } from "node:fs";
import { createBot, type BotContext } from "./toolkit/index.js";
import { initProfileStore } from "./profile-store.js";
import { initSessionStore } from "./session-store.js";

/** Per-chat ephemeral flow state. Durable data lives in the stores. */
export interface Session {
  step:
    | "idle"
    | "onboarding_awaiting_level"
    | "onboarding_awaiting_topics"
    | "free_chat"
    | "guided_select_topic"
    | "guided_active"
    | "progress"
    | "reminder";
  selectedLevel?: "beginner" | "intermediate" | "advanced";
  selectedTopics?: string[];
  exercisePrompt?: string;
  exerciseId?: string;
  currentSessionId?: string;
  userResponse?: string;
}

export type Ctx = BotContext<Session>;

/**
 * buildBot — assembles the bot, AUTO-LOADS every feature handler from
 * src/handlers/, then registers the global fallback. Does NOT start the bot.
 * Add a feature by creating src/handlers/<name>.ts that default-exports a grammY
 * Composer — NEVER edit this file (concurrent feature PRs would conflict).
 */
export async function buildBot(token: string) {
  const bot = createBot<Session>(token, {
    initial: () => ({ step: "idle" }),
  });

  // Initialize durable stores (in-memory by default; Redis in production).
  initProfileStore();
  initSessionStore();

  const dir = new URL("./handlers/", import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) =>
        (f.endsWith(".js") || f.endsWith(".ts")) &&
        !f.endsWith(".d.ts") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    files = [];
  }
  for (const file of files.sort()) {
    const mod = (await import(new URL(file, dir).href)) as { default?: Composer<Ctx> };
    if (!mod.default) {
      throw new Error(`handler ${file} must default-export a grammY Composer`);
    }
    bot.use(mod.default);
  }

  bot.on("message", (ctx) => ctx.reply("Sorry, I didn't understand that. Try /help."));

  return bot;
}
