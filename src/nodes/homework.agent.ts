import { loadPrompt } from "../prompts/loader.js";
import { createLLM, invokeLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("homework-agent");

const llm = createLLM({ model: "claude-sonnet-4-6", maxTokens: 2000, temperature: 0.3 });

export async function homeworkAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName, language } = state;

  log.info({ requestId: state.requestId, userMessage: userMessage.slice(0, 200) }, "Homework agent started");

  try {
    const today = new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const userContent = `${userName}: ${userMessage}`;
    log.info({ requestId: state.requestId, prompt: "homework", userContent: userContent.slice(0, 200) }, "LLM request");

    const { response, anthropicRequestId } = await invokeLLM(llm, [
      {
        role: "system",
        content: loadPrompt("homework", { TODAY: today, LANGUAGE: language === "th" ? "Thai" : "English" }),
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

    log.info({ requestId: state.requestId, anthropicRequestId, replyText: text.slice(0, 200) }, "Homework agent LLM response");

    return { replyText: text };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Homework agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้ตอบไม่ได้ตอนนี้อ่ะ ลองถามใหม่นะคับ 🐥",
      error: String(err),
    };
  }
}
