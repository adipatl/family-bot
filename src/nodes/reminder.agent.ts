import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import { loadPrompt } from "../prompts/loader.js";
import {
  addReminder,
  listReminders,
} from "../services/firestore.service.js";
import type { BotState } from "../graph/state.js";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250514",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 300,
  temperature: 0,
});

const LIST_PATTERN = /เช็ค reminder|ดู reminder|ดูเตือน|รายการเตือน|เตือนอะไรบ้าง/i;

export async function reminderAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userId, userName, groupId } = state;

  try {
    // List reminders
    if (LIST_PATTERN.test(userMessage)) {
      const reminders = await listReminders(groupId);

      if (reminders.length === 0) {
        return { replyText: "🔔 ไม่มีรายการเตือนที่รอค่ะ" };
      }

      const lines = reminders.map((r) => {
        const dueDate = r.dueAt.toDate().toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `• ${dueDate} — ${r.message} (โดย ${r.userName})`;
      });

      return {
        replyText: `🔔 รายการเตือน:\n${lines.join("\n")}`,
      };
    }

    // Add reminder — use Claude to parse when and what
    const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    const parseResponse = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("reminder", { NOW: now }),
      },
      { role: "user", content: userMessage },
    ]);

    const text =
      typeof parseResponse.content === "string"
        ? parseResponse.content
        : String(parseResponse.content);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        replyText: "ขอโทษค่ะ ไม่เข้าใจเวลาที่ต้องเตือน ลองบอกใหม่นะคะ",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const dueAt = new Date(parsed.dueAt);

    await addReminder(parsed.message, dueAt, userId, userName, groupId);

    const dueStr = dueAt.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      replyText: `🔔 ตั้งเตือนแล้วค่ะ\n📌 ${parsed.message}\n⏰ ${dueStr}`,
    };
  } catch (err) {
    console.error("[ReminderAgent] Error:", err);
    return {
      replyText: "อุ๊ปส์ คุกกี้ตั้งเตือนไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
