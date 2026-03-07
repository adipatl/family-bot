import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import { loadPrompt } from "../prompts/loader.js";
import type { messagingApi } from "@line/bot-sdk";

const llm = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 80,
  temperature: 0.8,
});

// Cute LINE stickers that match Kookie's personality
// Each entry: [packageId, stickerId]
const CUTE_STICKERS: [string, string][] = [
  ["11537", "52002734"], // happy
  ["11537", "52002735"], // cheerful
  ["11537", "52002736"], // excited
  ["11537", "52002738"], // wink
  ["11537", "52002739"], // love
  ["11537", "52002744"], // thumbs up
  ["11537", "52002750"], // working
  ["11537", "52002753"], // thinking
  ["11537", "52002757"], // ok!
  ["11537", "52002764"], // sparkle
  ["11538", "51626494"], // cute wave
  ["11538", "51626497"], // happy
  ["11538", "51626501"], // smile
  ["11538", "51626504"], // cheerful
  ["11538", "51626518"], // peace
  ["11539", "52114110"], // hi
  ["11539", "52114113"], // cute
  ["11539", "52114115"], // cheerful
  ["11539", "52114129"], // ok
];

function getRandomSticker(): messagingApi.StickerMessage {
  const [packageId, stickerId] =
    CUTE_STICKERS[Math.floor(Math.random() * CUTE_STICKERS.length)];
  return {
    type: "sticker",
    packageId,
    stickerId,
  };
}

export async function generateAckMessages(
  userMessage: string,
  userName: string,
): Promise<messagingApi.Message[]> {
  try {
    const response = await llm.invoke([
      { role: "system", content: loadPrompt("ack") },
      { role: "user", content: `${userName}: ${userMessage}` },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return [
      { type: "text", text: text.trim() },
      getRandomSticker(),
    ];
  } catch (err) {
    console.error("[AckService] LLM failed, using fallback:", err);
    // Fallback: just send a sticker if LLM fails
    return [getRandomSticker()];
  }
}
