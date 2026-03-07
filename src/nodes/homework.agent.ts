import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import { loadPrompt } from "../prompts/loader.js";
import type { BotState } from "../graph/state.js";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 1000,
  temperature: 0.3,
});

export async function homeworkAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("homework"),
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
    console.error("[HomeworkAgent] Error:", err);
    return {
      replyText: "อุ๊ปส์ คุกกี้ตอบไม่ได้ตอนนี้อ่ะ ลองถามใหม่นะคับ 🐥",
      error: String(err),
    };
  }
}
