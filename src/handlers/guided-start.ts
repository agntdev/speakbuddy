import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  EXERCISES,
  saveSession,
  generateSessionId,
  type GuidedExercise,
} from "../session-store.js";
import { getProfile, updateStreak, incrementSessionCount } from "../profile-store.js";
import { now } from "../clock.js";

registerMainMenuItem({ label: "📝 Guided Exercise", data: "guided:start", order: 20 });

const composer = new Composer<Ctx>();

const TOPIC_KEYBOARD = inlineKeyboard([
  [inlineButton("📖 Grammar", "guided:topic:grammar")],
  [inlineButton("📚 Vocabulary", "guided:topic:vocabulary")],
  [inlineButton("🗣️ Conversation", "guided:topic:conversation")],
  [inlineButton("🔊 Pronunciation", "guided:topic:pronunciation")],
  [inlineButton("⬅️ Back to menu", "menu:main")],
]);

composer.callbackQuery("guided:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getProfile(userId);
  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Tap /start to begin.");
    return;
  }

  ctx.session.step = "guided_select_topic";
  await ctx.reply(
    "Pick a topic for your guided exercise:",
    { reply_markup: TOPIC_KEYBOARD },
  );
});

composer.callbackQuery(/^guided:topic:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const topic = ctx.match[1];
  const exercises = EXERCISES[topic];
  if (!exercises || exercises.length === 0) {
    await ctx.reply("No exercises available for that topic yet. Try another!");
    return;
  }

  const exercise = exercises[Math.floor(Math.random() * exercises.length)];
  const sessionId = generateSessionId();

  ctx.session.step = "guided_active";
  ctx.session.exerciseId = exercise.exerciseId;
  ctx.session.currentSessionId = sessionId;
  ctx.session.exercisePrompt = exercise.prompt;

  await saveSession({
    sessionId,
    userId,
    mode: "guided",
    topic,
    messages: [{ role: "bot", text: exercise.prompt }],
    corrections: [],
    timestamp: now().getTime(),
  });

  const keyboard = inlineKeyboard([
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  await ctx.editMessageText(
    exercise.prompt,
    { reply_markup: keyboard },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "guided_active") return next();

  const userId = ctx.from?.id;
  if (!userId) return;

  const userText = ctx.message.text;
  const exerciseId = ctx.session.exerciseId;
  const sessionId = ctx.session.currentSessionId;

  if (!exerciseId || !sessionId) {
    ctx.session.step = "idle";
    await ctx.reply("Something went wrong. Tap /start to begin again.");
    return;
  }

  // Find the exercise
  let exercise: GuidedExercise | undefined;
  for (const topic of Object.keys(EXERCISES)) {
    const found = EXERCISES[topic].find((e) => e.exerciseId === exerciseId);
    if (found) {
      exercise = found;
      break;
    }
  }
  if (!exercise) {
    ctx.session.step = "idle";
    await ctx.reply("Exercise not found. Tap /start to begin again.");
    return;
  }

  await incrementSessionCount(userId);
  await updateStreak(userId, now().toISOString().slice(0, 10));

  // Evaluate the response (simple keyword matching for demonstration)
  const lowerResponse = userText.toLowerCase();
  const matchedTargets = exercise.targetStructures.filter((s) =>
    lowerResponse.includes(s.toLowerCase()),
  );
  const score = matchedTargets.length;
  const total = exercise.targetStructures.length;

  const feedback =
    score >= total * 0.5
      ? exercise.feedbackTemplates[0]
      : exercise.feedbackTemplates[1];

  // Update session with user response
  const { saveSession: save, getSession: get } = await import("../session-store.js");
  const session = await get(sessionId);
  if (session) {
    session.messages.push({ role: "user", text: userText });
    await save(session);
  }

  ctx.session.step = "idle";

  const keyboard = inlineKeyboard([
    [inlineButton("🔄 Try another exercise", "guided:start")],
    [inlineButton("📊 View progress", "progress:view")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  await ctx.reply(
    `${feedback}\n\nScore: ${score}/${total} target structures used.\n\nKeep practicing — you're making great progress!`,
    { reply_markup: keyboard },
  );
});

export default composer;
