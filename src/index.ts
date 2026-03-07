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

const app = express();

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

      // Get user display name
      let userName = "สมาชิก";
      try {
        if (messageEvent.source.type === "group" && userId !== "unknown") {
          const profile = await client.getGroupMemberProfile(groupId, userId);
          userName = profile.displayName;
        } else if (userId !== "unknown") {
          const profile = await client.getProfile(userId);
          userName = profile.displayName;
        }
      } catch {
        // Use default name if profile fetch fails
      }

      console.log(`[Webhook] ${userName}: ${textMessage.text}`);

      try {
        const result = await graph.invoke({
          userMessage: textMessage.text,
          userName,
          userId,
          groupId,
        });

        console.log(
          `[Webhook] Routed to: ${result.routedTo}, Reply: ${result.replyText?.substring(0, 50)}...`,
        );

        if (result.replyText && messageEvent.replyToken) {
          await client.replyMessage({
            replyToken: messageEvent.replyToken,
            messages: [{ type: "text", text: result.replyText }],
          });
        }
      } catch (err) {
        console.error("[Webhook] Graph invocation error:", err);

        if (messageEvent.replyToken) {
          await client.replyMessage({
            replyToken: messageEvent.replyToken,
            messages: [
              {
                type: "text",
                text: "ขอโทษค่ะ เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ",
              },
            ],
          });
        }
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
});
