import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  mainMenuKeyboard,
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { getProfile, upsertProfile } from "../profile-store.js";

registerMainMenuItem({ label: "💬 Free Chat", data: "free_chat:start", order: 10 });
registerMainMenuItem({ label: "📝 Guided Exercise", data: "guided:start", order: 20 });
registerMainMenuItem({ label: "📊 View Progress", data: "progress:view", order: 30 });
registerMainMenuItem({ label: "🔔 Daily Reminder", data: "reminder:toggle", order: 40 });

const WELCOME = "👋 Welcome! Tap a button below to get started.";

const LEVEL_KEYBOARD = inlineKeyboard([
  [inlineButton("🟢 Beginner", "onboard:level:beginner")],
  [inlineButton("🟡 Intermediate", "onboard:level:intermediate")],
  [inlineButton("🔴 Advanced", "onboard:level:advanced")],
]);

const TOPICS = ["grammar", "vocabulary", "conversation", "pronunciation"];
const TOPIC_LABELS: Record<string, string> = {
  grammar: "📖 Grammar",
  vocabulary: "📚 Vocabulary",
  conversation: "🗣️ Conversation",
  pronunciation: "🔊 Pronunciation",
};

function buildTopicKeyboard(selected: string[]) {
  return inlineKeyboard([
    ...TOPICS.map((t) => [
      inlineButton(
        selected.includes(t) ? `✅ ${TOPIC_LABELS[t]}` : TOPIC_LABELS[t],
        `onboard:topic:${t}`,
      ),
    ]),
    [inlineButton(selected.length > 0 ? "Done ✓" : "Skip", "onboard:topics:done")],
  ]);
}

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getProfile(userId);
  if (profile) {
    // Returning user — show main menu.
    ctx.session.step = "idle";
    await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
    return;
  }

  // New user — start onboarding.
  ctx.session.step = "onboarding_awaiting_level";
  await ctx.reply(
    "👋 Welcome to English Tutor! I'll help you improve your conversational English.\n\nFirst, what's your current level?",
    { reply_markup: LEVEL_KEYBOARD },
  );
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("onboard:level:beginner", async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleLevelChoice(ctx, "beginner");
});

composer.callbackQuery("onboard:level:intermediate", async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleLevelChoice(ctx, "intermediate");
});

composer.callbackQuery("onboard:level:advanced", async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleLevelChoice(ctx, "advanced");
});

async function handleLevelChoice(
  ctx: Ctx,
  level: "beginner" | "intermediate" | "advanced",
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  ctx.session.selectedLevel = level;
  ctx.session.selectedTopics = [];
  ctx.session.step = "onboarding_awaiting_topics";

  const labels: Record<string, string> = {
    beginner: "🟢 Beginner",
    intermediate: "🟡 Intermediate",
    advanced: "🔴 Advanced",
  };

  await ctx.editMessageText(
    `Got it — ${labels[level]}.\n\nNow pick the topics you'd like to practice (tap to toggle, then tap Done):`,
    { reply_markup: buildTopicKeyboard([]) },
  );
}

composer.callbackQuery(/^onboard:topic:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const topic = ctx.match[1];
  if (!TOPICS.includes(topic)) return;

  const selected = ctx.session.selectedTopics ?? [];
  if (selected.includes(topic)) {
    ctx.session.selectedTopics = selected.filter((t) => t !== topic);
  } else {
    ctx.session.selectedTopics = [...selected, topic];
  }

  await ctx.editMessageReplyMarkup({
    reply_markup: buildTopicKeyboard(ctx.session.selectedTopics ?? []),
  });
});

composer.callbackQuery("onboard:topics:done", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const name = ctx.from?.first_name ?? "there";
  const level = ctx.session.selectedLevel ?? "beginner";
  const topics = ctx.session.selectedTopics ?? [];

  await upsertProfile(userId, {
    name,
    learningLevel: level,
    preferredTopics: topics,
  });

  ctx.session.step = "idle";
  ctx.session.selectedLevel = undefined;
  ctx.session.selectedTopics = undefined;

  const topicText =
    topics.length > 0
      ? topics.map((t) => TOPIC_LABELS[t] ?? t).join(", ")
      : "all topics";

  await ctx.editMessageText(
    `All set, ${name}! Your level is ${level} and you'll practice ${topicText}.\n\nTap a button below to start practicing.`,
    { reply_markup: mainMenuKeyboard() },
  );
});

export default composer;
