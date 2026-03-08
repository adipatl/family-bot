import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import {
  addReminder,
  listReminders,
} from "../services/firestore.service.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("reminder-agent");

const llm = createLLM({ model: "claude-sonnet-4-6", maxTokens: 1000 });

const LIST_PATTERN = /เช็ค reminder|ดู reminder|ดูเตือน|รายการเตือน|เตือนอะไรบ้าง/i;

export async function reminderAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userId, userName, groupId } = state;

  log.info({ requestId: state.requestId, userMessage: userMessage.slice(0, 200) }, "Reminder agent started");

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

    log.info({ requestId: state.requestId, prompt: "reminder", userContent: userMessage.slice(0, 200) }, "LLM request");

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

    log.info({ requestId: state.requestId, llmResponse: text.slice(0, 300) }, "Reminder agent LLM response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        replyText: "ขอโทษค่ะ ไม่เข้าใจเวลาที่ต้องเตือน ลองบอกใหม่นะคะ",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const dueAt = new Date(parsed.dueAt);

    log.info({ requestId: state.requestId, reminderMessage: parsed.message, dueAt: parsed.dueAt }, "Reminder parsed intent");

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
    log.error({ requestId: state.requestId, err }, "Reminder agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้ตั้งเตือนไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
