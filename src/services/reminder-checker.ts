import { messagingApi } from "@line/bot-sdk";
import { getDueReminders, markReminderNotified } from "./firestore.service.js";
import { config } from "../config/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("reminder-checker");

const POLL_INTERVAL_MS = 60_000; // Check every minute

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startReminderChecker(): void {
  if (intervalId) return;

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  log.info("Reminder checker started (polling every 60s)");

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
        log.info({ reminderId: reminder.id, groupId: reminder.groupId }, "Reminder notified");
      }
    } catch (err) {
      log.error({ err }, "Reminder checker cycle failed");
    }
  }, POLL_INTERVAL_MS);
}

export function stopReminderChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
