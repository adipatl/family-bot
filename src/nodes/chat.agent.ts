import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";

const llm = createLLM({ maxTokens: 2000, temperature: 0.7 });

export async function chatAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("chat"),
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
    console.error("[ChatAgent] Error:", err);
    return {
      replyText: "สวัสดี~ คุกกี้พร้อมช่วยเสมอนะคับ 🐥",
      error: String(err),
    };
  }
}
