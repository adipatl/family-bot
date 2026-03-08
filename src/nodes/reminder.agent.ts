import { loadPrompt } from "../prompts/loader.js";
import { createLLM, invokeLLM } from "../llm.js";
import {
  addReminder,
  listReminders,
  cancelRemindersByKeyword,
} from "../services/firestore.service.js";
import type { Reminder } from "../services/firestore.service.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("reminder-agent");

const llm = createLLM({ model: "claude-sonnet-4-6", maxTokens: 1000 });

const LIST_PATTERN = /เช็ค reminder|ดู reminder|ดูเตือน|รายการเตือน|เตือนอะไรบ้าง/i;

function formatReminderList(reminders: Reminder[]): string {
  if (reminders.length === 0) {
    return "🔔 ไม่มีรายการเตือนที่รอค่ะ";
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
  return `🔔 รายการเตือน:\n${lines.join("\n")}`;
}

export async function reminderAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userId, userName, groupId } = state;

  log.info({ requestId: state.requestId, userMessage: userMessage.slice(0, 200) }, "Reminder agent started");

  try {
    // Fast-path: list reminders without LLM call
    if (LIST_PATTERN.test(userMessage)) {
      log.info({ requestId: state.requestId, service: "listReminders", groupId }, "Calling listReminders (fast-path)");
      const reminders = await listReminders(groupId);
      log.info({ requestId: state.requestId, reminderCount: reminders.length }, "listReminders result");
      return { replyText: formatReminderList(reminders) };
    }

    // Use Claude to parse intent and action
    const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

    log.info({ requestId: state.requestId, prompt: "reminder", userContent: userMessage.slice(0, 200) }, "LLM request");

    const { response: parseResponse, anthropicRequestId } = await invokeLLM(llm, [
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

    log.info({ requestId: state.requestId, anthropicRequestId, llmResponse: text.slice(0, 300) }, "Reminder agent LLM response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        replyText: "ขอโทษค่ะ ไม่เข้าใจเวลาที่ต้องเตือน ลองบอกใหม่นะคะ",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    log.info(
      { requestId: state.requestId, action: parsed.action, confidence: parsed.confidence, message: parsed.message?.slice(0, 100), dueAt: parsed.dueAt, searchKeyword: parsed.searchKeyword },
      "Reminder parsed action",
    );

    switch (parsed.action) {
      case "set": {
        const dueAt = new Date(parsed.dueAt);
        if (!parsed.message || !parsed.dueAt || isNaN(dueAt.getTime())) {
          return {
            replyText: "ขอโทษค่ะ ไม่เข้าใจเวลาหรือข้อความที่ต้องเตือน ลองบอกใหม่นะคะ",
          };
        }

        log.info(
          { requestId: state.requestId, reminderMessage: parsed.message, dueAt: parsed.dueAt },
          "Setting reminder",
        );

        log.info({ requestId: state.requestId, service: "addReminder", reminderMessage: parsed.message, dueAt: parsed.dueAt }, "Calling addReminder");
        await addReminder(parsed.message, dueAt, userId, userName, groupId);
        log.info({ requestId: state.requestId }, "addReminder result: success");

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
      }

      case "list": {
        log.info({ requestId: state.requestId, service: "listReminders", groupId }, "Calling listReminders");
        const reminders = await listReminders(groupId);
        log.info({ requestId: state.requestId, reminderCount: reminders.length }, "listReminders result");
        return { replyText: formatReminderList(reminders) };
      }

      case "cancel": {
        if (!parsed.searchKeyword) {
          return {
            replyText: "บอกด้วยนะคะว่าจะยกเลิกเตือนเรื่องอะไร เช่น 'ยกเลิกเตือนเรื่องซื้อนม'",
          };
        }

        log.info({ requestId: state.requestId, service: "cancelRemindersByKeyword", keyword: parsed.searchKeyword }, "Calling cancelRemindersByKeyword");
        const cancelled = await cancelRemindersByKeyword(groupId, parsed.searchKeyword);
        log.info({ requestId: state.requestId, cancelledCount: cancelled.length }, "cancelRemindersByKeyword result");

        if (cancelled.length === 0) {
          return {
            replyText: `🔔 ไม่เจอรายการเตือนที่เกี่ยวกับ "${parsed.searchKeyword}" ค่ะ`,
          };
        }

        const lines = cancelled.map((r) => `• ${r.message}`);
        return {
          replyText: `🔔 ยกเลิกเตือนแล้วค่ะ:\n${lines.join("\n")}`,
        };
      }

      case "unknown":
      default: {
        return {
          replyText: "ขอโทษค่ะ ไม่เข้าใจว่าจะเตือนอะไร ลองบอกใหม่นะคะ เช่น 'เตือน 5 โมงเย็น ไปรับลูก' หรือ 'ดู reminder'",
        };
      }
    }
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Reminder agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้ตั้งเตือนไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
