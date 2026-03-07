import express from "express";
import {
  middleware,
  messagingApi,
  type WebhookEvent,
  type TextEventMessage,
  type MessageEvent,
} from "@line/bot-sdk";
import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "./config/index.js";
import { getGraph } from "./graph/index.js";
import { startReminderChecker } from "./services/reminder-checker.js";
import { generateAckMessages } from "./services/ack.service.js";

const app = express();

// In-memory profile cache (userId → displayName)
const profileCache = new Map<string, string>();

// LINE webhook signature verification middleware
app.post(
  "/webhook",
  middleware({
    channelSecret: config.line.channelSecret,
  }),
  async (req, res) => {
    const events: WebhookEvent[] = req.body.events;
    res.status(200).json({ status: "ok" });

    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: config.line.channelAccessToken,
    });

    const graph = getGraph();

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") {
        continue;
      }

      const messageEvent = event as MessageEvent;
      const textMessage = messageEvent.message as TextEventMessage;
      const userId = messageEvent.source.userId ?? "unknown";
      const groupId =
        messageEvent.source.type === "group"
          ? messageEvent.source.groupId
          : userId;

      // Use cached name or default — never block on profile fetch
      const cachedName = profileCache.get(userId);
      const userName = cachedName ?? "สมาชิก";

      console.log(`[Webhook] ${userName}: ${textMessage.text}`);

      // Fire-and-forget: populate profile cache for next time
      if (!cachedName && userId !== "unknown") {
        (async () => {
          try {
            if (
              messageEvent.source.type === "group" &&
              messageEvent.source.groupId
            ) {
              const profile = await client.getGroupMemberProfile(
                messageEvent.source.groupId,
                userId,
              );
              profileCache.set(userId, profile.displayName);
            } else {
              const profile = await client.getProfile(userId);
              profileCache.set(userId, profile.displayName);
            }
          } catch {
            // Profile fetch failed — will retry next message
          }
        })();
      }

      // Start ack IMMEDIATELY (don't wait for profile fetch)
      // Use AbortController to timeout ack LLM after 5 seconds
      const ackPromise = (async () => {
        try {
          const ackWithTimeout = Promise.race([
            generateAckMessages(textMessage.text, userName),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Ack LLM timeout")), 5000),
            ),
          ]);

          const ackMessages = await ackWithTimeout;
          if (ackMessages && messageEvent.replyToken) {
            await client.replyMessage({
              replyToken: messageEvent.replyToken,
              messages: ackMessages,
            });
            return true;
          }
          return false;
        } catch (err) {
          console.error("[Webhook] Ack failed:", err);
          return false;
        }
      })();

      const graphPromise = graph.invoke({
        userMessage: textMessage.text,
        userName,
        userId,
        groupId,
      });

      const [ackSent, graphResult] = await Promise.allSettled([
        ackPromise,
        graphPromise,
      ]);

      const target = groupId ?? userId;

      if (graphResult.status === "fulfilled") {
        const result = graphResult.value;
        console.log(
          `[Webhook] Routed to: ${result.routedTo}, Reply: ${result.replyText?.substring(0, 50)}...`,
        );

        if (result.replyText) {
          await client.pushMessage({
            to: target,
            messages: [{ type: "text", text: result.replyText }],
          });
        }
      } else {
        console.error(
          "[Webhook] Graph invocation error:",
          graphResult.reason,
        );

        await client.pushMessage({
          to: target,
          messages: [
            {
              type: "text",
              text: "อุ๊ปส์ คุกกี้พลาดไปหน่อย ลองใหม่อีกทีนะคับ 🐥",
            },
          ],
        });
      }
    }
  },
);

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", bot: "น้องบ้าน Family Bot v2" });
});

// Start server
app.listen(config.port, () => {
  console.log(`🏠 น้องบ้าน Family Bot v2 running on port ${config.port}`);
  startReminderChecker();

  // Warm up LLM connections — pre-establish HTTP/2 + TLS to Anthropic API
  const warmup = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    anthropicApiKey: config.anthropic.apiKey,
    maxTokens: 1,
  });
  warmup
    .invoke([{ role: "user", content: "hi" }])
    .then(() => console.log("🔌 LLM connection warmed up"))
    .catch(() => console.warn("⚠️ LLM warmup failed (will connect on first request)"));
});
