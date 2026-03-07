import { messagingApi } from "@line/bot-sdk";
import { getDueReminders, markReminderNotified } from "./firestore.service.js";
import { config } from "../config/index.js";

const POLL_INTERVAL_MS = 60_000; // Check every minute

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReminderChecker(): void {
  if (intervalId) return;

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  console.log("🔔 Reminder checker started (polling every 60s)");

  intervalId = setInterval(async () => {
    try {
      const dueReminders = await getDueReminders();

      for (const reminder of dueReminders) {
        const text = `🐥 คุกกี้มาเตือนน้า~\n🔔 ${reminder.message}\n(${reminder.userName} บอกให้เตือนค่าบ)`;

        await client.pushMessage({
          to: reminder.groupId,
          messages: [{ type: "text", text }],
        });

        await markReminderNotified(reminder.id!);
        console.log(`Notified reminder: ${reminder.id}`);
      }
    } catch (err) {
      console.error("Reminder checker error:", err);
    }
  }, POLL_INTERVAL_MS);
}

export function stopReminderChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
