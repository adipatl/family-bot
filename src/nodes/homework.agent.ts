import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("homework-agent");

const llm = createLLM({ model: "claude-sonnet-4-6", maxTokens: 2000, temperature: 0.3 });

export async function homeworkAgent(
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
        content: loadPrompt("homework", { TODAY: today }),
      },
      {
        role: "user",
        content: `${userName} ถามว่า: ${userMessage}`,
      },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: text };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Homework agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้ตอบไม่ได้ตอนนี้อ่ะ ลองถามใหม่นะคับ 🐥",
      error: String(err),
    };
  }
}
