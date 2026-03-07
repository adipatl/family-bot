import crypto from "crypto";
import express from "express";
import {
  middleware,
  messagingApi,
  type WebhookEvent,
  type TextEventMessage,
  type MessageEvent,
} from "@line/bot-sdk";
import { config } from "./config/index.js";
import { getGraph } from "./graph/index.js";
import { startReminderChecker } from "./services/reminder-checker.js";
import { generateAckMessages } from "./services/ack.service.js";
import { createLLM } from "./llm.js";
import { createLogger } from "./logger.js";

const log = createLogger("webhook");

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
      const isGroup = messageEvent.source.type === "group";
      const groupId =
        messageEvent.source.type === "group"
          ? messageEvent.source.groupId
          : userId;

      // In group chats, only respond when the bot is mentioned
      const botUserId: string | undefined = req.body.destination;
      const isBotMentioned = textMessage.mention?.mentionees?.some(
        (m) => m.type === "user" && m.userId === botUserId,
      );

      if (isGroup && !isBotMentioned) {
        continue;
      }

      // Remove @bot mention text so the LLM sees clean input
      let userMessage = textMessage.text;
      if (isBotMentioned && textMessage.mention?.mentionees) {
        const selfMentions = textMessage.mention.mentionees
          .filter((m) => m.type === "user" && m.userId === botUserId)
          .sort((a, b) => b.index - a.index); // reverse order to preserve indices
        for (const m of selfMentions) {
          userMessage =
            userMessage.slice(0, m.index) + userMessage.slice(m.index + m.length);
        }
        userMessage = userMessage.trim();
      }

      // Use cached name or default — never block on profile fetch
      const cachedName = profileCache.get(userId);
      const userName = cachedName ?? "สมาชิก";

      const requestId = crypto.randomUUID().slice(0, 8);

      log.info({ requestId, userId, groupId, messageLength: userMessage.length }, "Message received");
      log.debug({ requestId, userMessage }, "Message content");

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
          } catch (err) {
            log.warn({ requestId, userId, err }, "Profile fetch failed");
          }
        })();
      }

      // Send ack immediately — static messages, no LLM needed
      const ackPromise = (async () => {
        try {
          const ackMessages = generateAckMessages(userMessage);
          if (messageEvent.replyToken) {
            await client.replyMessage({
              replyToken: messageEvent.replyToken,
              messages: ackMessages,
            });
            return true;
          }
          return false;
        } catch (err) {
          log.warn({ requestId, err }, "Ack reply failed");
          return false;
        }
      })();

      const startTime = Date.now();

      const graphPromise = graph.invoke({
        userMessage,
        userName,
        userId,
        groupId,
        requestId,
      });

      const [ackSent, graphResult] = await Promise.allSettled([
        ackPromise,
        graphPromise,
      ]);

      const durationMs = Date.now() - startTime;
      const target = groupId ?? userId;

      if (graphResult.status === "fulfilled") {
        const result = graphResult.value;
        log.info(
          { requestId, routedTo: result.routedTo, durationMs, replyLength: result.replyText?.length },
          "Response sent",
        );

        if (result.replyText) {
          await client.pushMessage({
            to: target,
            messages: [{ type: "text", text: result.replyText }],
          });
        }
      } else {
        log.error(
          { requestId, err: graphResult.reason, durationMs },
          "Graph invocation failed",
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
  log.info({ port: config.port }, "Family Bot v2 started");
  startReminderChecker();

  // Warm up LLM connections — pre-establish HTTP/2 + TLS to Anthropic API
  const warmup = createLLM({ maxTokens: 1 });
  warmup
    .invoke([{ role: "user", content: "hi" }])
    .then(() => log.info("LLM connection warmed up"))
    .catch(() => log.warn("LLM warmup failed (will connect on first request)"));
});
