import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("chat-agent");

const llm = createLLM({ maxTokens: 2000, temperature: 0.7 });

export async function chatAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const today = new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const response = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("chat", { TODAY: today }),
      },
      {
        role: "user",
        content: `${userName}: ${userMessage}`,
      },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: text };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Chat agent failed");
    return {
      replyText: "สวัสดี~ คุกกี้พร้อมช่วยเสมอนะคับ 🐥",
      error: String(err),
    };
  }
}
