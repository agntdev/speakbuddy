import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getProfile, updateProfile } from "../profile-store.js";

registerMainMenuItem({ label: "🔔 Daily Reminder", data: "reminder:toggle", order: 40 });

const composer = new Composer<Ctx>();

composer.callbackQuery("reminder:toggle", async (ctx) => {
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

  const newState = !profile.reminderEnabled;
  await updateProfile(userId, { reminderEnabled: newState });

  if (newState) {
    const keyboard = inlineKeyboard([
      [inlineButton("🔔 Reminder is ON", "reminder:toggle")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);

    await ctx.reply(
      "✅ Daily reminder is now ON.\n\nYou'll get a practice reminder every day at 9:00 AM.",
      { reply_markup: keyboard },
    );
  } else {
    const keyboard = inlineKeyboard([
      [inlineButton("🔕 Reminder is OFF", "reminder:toggle")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);

    await ctx.reply(
      "Daily reminder is now OFF.\n\nYou won't receive practice reminders.",
      { reply_markup: keyboard },
    );
  }
});

export default composer;
