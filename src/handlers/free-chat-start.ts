import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import {
  saveSession,
  saveCorrection,
  generateSessionId,
  generateCorrectionId,
  type CorrectionItem,
} from "../session-store.js";
import { getProfile, updateStreak, incrementSessionCount } from "../profile-store.js";
import { now } from "../clock.js";

registerMainMenuItem({ label: "💬 Free Chat", data: "free_chat:start", order: 10 });

const PROMPTS = [
  "Tell me about your favorite hobby.",
  "What did you do last weekend?",
  "Describe your dream vacation destination.",
  "What's your favorite food and why?",
  "Tell me about a memorable experience you've had.",
  "What are your goals for learning English?",
  "Describe a typical day in your life.",
  "What kind of music do you enjoy?",
];

function getRandomPrompt(): string {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

interface Analysis {
  hasErrors: boolean;
  explanation: string;
  example: string;
}

function analyzeForErrors(text: string): Analysis {
  const lower = text.toLowerCase();

  if (/\bi\b/.test(text) && !/\bi['']m\b/.test(text) && !/\bi['']ll\b/.test(text) && !/\bi['']ve\b/.test(text) && !/\bi['']d\b/.test(text) && !/\biam\b/.test(lower)) {
    if (/\bi\s/.test(text)) {
      return {
        hasErrors: true,
        explanation: "Always capitalize 'I' when referring to yourself.",
        example: 'Correct: "I went to the store."',
      };
    }
  }

  if (/\b(he|she|it)\s+(go|play|run|eat|like|want|have|do|make|take|come|see|know|think|give|say|get|tell|find|feel|leave|put|keep|let|begin|seem|help|show|hear|move|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain|suggest|raise|pass|sell|require|report|decide|pull)\b/.test(lower)) {
    return {
      hasErrors: true,
      explanation: "Third-person singular verbs need an '-s' ending in present simple.",
      example: 'Correct: "She goes to school every day."',
    };
  }

  if (/\b(goed|runned|playded|eatd|haved|doed|makeed|takeed|seeed|knowed|thinked|giveed|geted|feeled|leaveed|puteed|kepeed|leteed|begined|seemeed|helede|showeed|hearede|runeed|moveede|liveede|holded|bringeede|happeneede|writeede|provideede|siteede|standeed|loseede|payeed|meetee|continueede|setee|learneede|changeede|leadeede|understandee|watchee|followee|stopeede|createee|speakee|readee|allowee|addee|spendeed|growee|openee|walkee|wineee|offeree|rememberdee|lovedee|consideree|appeareee|buyeee|waiteee|serveeee|dieeee|sendeee|expecteee|buildeee|steeee|falleee|cuteeee|reacheee|killeee|remaieee|suggesteee|raiseeee|passeee|sellee|requireeee|reporteee|decideeee|puleeee)\b/.test(lower)) {
    return {
      hasErrors: true,
      explanation: "Many English verbs are irregular. They don't follow the '-ed' pattern.",
      example: 'Correct: "I went" (not "goed"), "She ate" (not "eatd").',
    };
  }

  if (/\btheir\b/.test(text) && !/\btheir\s+(car|house|dog|cat|kids|children|family|friend|book|phone|room|name|work|job|home|life|day|time|place|country|city|idea|plan|story|school|office|car|money|thing|way|opinion)\b/.test(lower)) {
    if (/they're/.test(lower)) {
      return {
        hasErrors: true,
        explanation: "'their' shows possession. 'they're' means 'they are'.",
        example: 'Correct: "They\'re going to the store."',
      };
    }
  }

  return {
    hasErrors: false,
    explanation: "Your sentence looks good! Nice job.",
    example: text,
  };
}

const composer = new Composer<Ctx>();

composer.callbackQuery("free_chat:start", async (ctx) => {
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

  const sessionId = generateSessionId();
  ctx.session.currentSessionId = sessionId;
  ctx.session.step = "free_chat";

  const prompt = getRandomPrompt();
  ctx.session.exercisePrompt = prompt;

  await saveSession({
    sessionId,
    userId,
    mode: "free_chat",
    topic: profile.preferredTopics[0] ?? "general",
    messages: [{ role: "bot", text: prompt }],
    corrections: [],
    timestamp: now().getTime(),
  });

  await ctx.reply(prompt, {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: "Type your response…",
    },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "free_chat") return next();

  const userId = ctx.from?.id;
  if (!userId) return;

  const userText = ctx.message.text;
  ctx.session.userResponse = userText;

  const analysis = analyzeForErrors(userText);

  await incrementSessionCount(userId);
  await updateStreak(userId, now().toISOString().slice(0, 10));

  const sessionId = ctx.session.currentSessionId;
  if (sessionId) {
    const { saveSession: save, getSession: get } = await import("../session-store.js");
    const session = await get(sessionId);
    if (session) {
      session.messages.push({ role: "user", text: userText });
      await save(session);
    }
  }

  if (analysis.hasErrors) {
    const correctionId = generateCorrectionId();
    if (sessionId) {
      const correction: CorrectionItem = {
        correctionId,
        sessionId,
        originalText: userText,
        correctedText: userText,
        explanation: analysis.explanation,
        example: analysis.example,
        timestamp: now().getTime(),
      };
      await saveCorrection(correction);
    }

    const keyboard = inlineKeyboard([
      [inlineButton("✅ Save correction", `correction:save:${correctionId}`)],
      [inlineButton("💬 Continue chatting", "free_chat:start")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);

    await ctx.reply(
      `📝 Correction:\n\n${analysis.explanation}\n\nExample: ${analysis.example}`,
      { reply_markup: keyboard },
    );
  } else {
    const keyboard = inlineKeyboard([
      [inlineButton("💬 Continue chatting", "free_chat:start")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);

    await ctx.reply(
      "Great job! Your English looks natural here. Keep going!",
      { reply_markup: keyboard },
    );
  }
});

composer.callbackQuery(/^correction:save:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Correction saved!" });
});

export default composer;
