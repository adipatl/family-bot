import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("polish");

const llm = createLLM({ maxTokens: 1000, temperature: 0.6 });

export async function polishNode(
  state: BotState,
): Promise<Partial<BotState>> {
  const { replyText, error, language } = state;

  // Skip polish if there's an error or no reply
  if (!replyText || error) {
    return {};
  }

  try {
    const response = await llm.invoke([
      { role: "system", content: loadPrompt("polish") },
      {
        role: "user",
        content: `Polish this message in Kookie's voice. Output language: ${language === "th" ? "Thai" : "English"}.\n\n${replyText}`,
      },
    ]);

    const polished =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: polished };
  } catch (err) {
    log.warn({ requestId: state.requestId, err }, "Polish failed, keeping original");
    // If polish fails, keep original reply
    return {};
  }
}
