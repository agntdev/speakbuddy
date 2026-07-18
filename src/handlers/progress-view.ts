import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getProfile } from "../profile-store.js";
import { getUserSessions, getAllUserCorrections } from "../session-store.js";

registerMainMenuItem({ label: "📊 View Progress", data: "progress:view", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("progress:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const profile = await getProfile(userId);
  if (!profile) {
    await ctx.reply(
      "You haven't set up your profile yet! Tap /start to begin.",
    );
    return;
  }

  const sessions = await getUserSessions(userId);
  const corrections = await getAllUserCorrections(userId);

  const streak = profile.currentStreak;
  const streakText =
    streak > 0
      ? `🔥 ${streak}-day streak${streak > 1 ? " — keep it up!" : ""}`
      : "No active streak yet — practice today to start one!";

  const sessionCount = profile.sessionCount;
  const correctionCount = corrections.length;

  let text =
    `📊 Your Progress\n\n` +
    `Level: ${capitalize(profile.learningLevel)}\n` +
    `Sessions: ${sessionCount}\n` +
    `Saved corrections: ${correctionCount}\n` +
    `${streakText}`;

  if (corrections.length > 0) {
    const recent = corrections.slice(-3);
    text += "\n\nRecent corrections:\n";
    for (const c of recent) {
      text += `\n• "${c.originalText.slice(0, 40)}${c.originalText.length > 40 ? "…" : ""}"\n  → ${c.explanation}`;
    }
  } else {
    text += "\n\nNo saved corrections yet — start a free chat to get feedback on your writing!";
  }

  const keyboard = inlineKeyboard([
    [inlineButton("💬 Free Chat", "free_chat:start")],
    [inlineButton("📝 Guided Exercise", "guided:start")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);

  await ctx.reply(text, { reply_markup: keyboard });
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default composer;
