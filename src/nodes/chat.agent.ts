import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("chat-agent");

const llm = createLLM({ maxTokens: 2000, temperature: 0.7 });

export async function chatAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName, language } = state;

  log.info({ requestId: state.requestId, userMessage: userMessage.slice(0, 200) }, "Chat agent started");

  try {
    const today = new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const userContent = `${userName}: ${userMessage}`;
    log.info({ requestId: state.requestId, prompt: "chat", userContent: userContent.slice(0, 200) }, "LLM request");

    const response = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("chat", { TODAY: today, LANGUAGE: language === "th" ? "Thai" : "English" }),
      },
      {
        role: "user",
        content: userContent,
      },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    log.info({ requestId: state.requestId, replyText: text.slice(0, 200) }, "Chat agent LLM response");

    return { replyText: text };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Chat agent failed");
    return {
      replyText: "สวัสดี~ คุกกี้พร้อมช่วยเสมอนะคับ 🐥",
      error: String(err),
    };
  }
}
