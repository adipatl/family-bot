import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";

const llm = createLLM({ maxTokens: 500, temperature: 0.6 });

export async function polishNode(
  state: BotState,
): Promise<Partial<BotState>> {
  const { replyText, error } = state;

  // Skip polish if there's an error or no reply
  if (!replyText || error) {
    return {};
  }

  try {
    const response = await llm.invoke([
      { role: "system", content: loadPrompt("polish") },
      {
        role: "user",
        content: `ช่วย polish ข้อความนี้ให้เป็นน้ำเสียงคุกกี้:\n\n${replyText}`,
      },
    ]);

    const polished =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: polished };
  } catch (err) {
    console.error("[PolishNode] Error:", err);
    // If polish fails, keep original reply
    return {};
  }
}
