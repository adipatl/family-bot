import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "./config/index.js";

/**
 * Shared LLM factory with retry + timeout defaults.
 * All agents should use this instead of creating ChatAnthropic directly.
 */
export function createLLM(opts: {
  maxTokens: number;
  temperature?: number;
  model?: string;
  timeout?: number;
}) {
  return new ChatAnthropic({
    model: opts.model ?? "claude-haiku-4-5-20251001",
    anthropicApiKey: config.anthropic.apiKey,
    maxTokens: opts.maxTokens,
    temperature: opts.temperature ?? 0,
    maxRetries: 3,
    clientOptions: { timeout: opts.timeout ?? 30_000 },
  });
}
