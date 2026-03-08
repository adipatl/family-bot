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

  log.info({ requestId: state.requestId, inputLength: replyText.length }, "Polish started");

  try {
    const userContent = `Polish this message in Kookie's voice. Output language: ${language === "th" ? "Thai" : "English"}.\n\n${replyText}`;
    log.info({ requestId: state.requestId, prompt: "polish", userContent: userContent.slice(0, 200) }, "LLM request");

    const response = await llm.invoke([
      { role: "system", content: loadPrompt("polish") },
      {
        role: "user",
        content: userContent,
      },
    ]);

    const polished =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    log.info({ requestId: state.requestId, outputLength: polished.length, polishedText: polished.slice(0, 200) }, "Polish completed");

    return { replyText: polished };
  } catch (err) {
    log.warn({ requestId: state.requestId, err }, "Polish failed, keeping original");
    // If polish fails, keep original reply
    return {};
  }
}
