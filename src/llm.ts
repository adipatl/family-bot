import { AsyncLocalStorage } from "node:async_hooks";
import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "./config/index.js";

/** Captures the Anthropic request ID (`req_...`) from HTTP response headers. */
const reqIdStore = new AsyncLocalStorage<{ anthropicRequestId?: string }>();

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
    clientOptions: {
      timeout: opts.timeout ?? 30_000,
      fetch: async (url: string | Request | URL, init?: RequestInit) => {
        const res = await globalThis.fetch(url, init);
        const store = reqIdStore.getStore();
        if (store) {
          store.anthropicRequestId =
            res.headers.get("request-id") ?? undefined;
        }
        return res;
      },
    },
  });
}

/**
 * Invoke an LLM and capture the Anthropic request ID from the response header.
 * Returns both the AIMessage response and the `req_...` ID for logging.
 */
export async function invokeLLM(
  llm: ChatAnthropic,
  messages: Parameters<ChatAnthropic["invoke"]>[0],
) {
  const store = { anthropicRequestId: undefined as string | undefined };
  const response = await reqIdStore.run(store, () => llm.invoke(messages));
  return { response, anthropicRequestId: store.anthropicRequestId };
}
