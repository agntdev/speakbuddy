import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ How to use English Tutor:\n\n" +
  "Tap /start to open the menu, then pick what you want from the buttons.\n\n" +
  "💬 Free Chat — Practice conversation with AI feedback\n" +
  "📝 Guided Exercise — Targeted practice on specific skills\n" +
  "📊 View Progress — See your streaks and saved corrections\n" +
  "🔔 Daily Reminder — Get a daily nudge to practice\n\n" +
  "Everything is button-driven — just tap to get started!";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;
