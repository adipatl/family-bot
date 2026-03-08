import { addNote, listNotes } from "../services/firestore.service.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";

const log = createLogger("notes-agent");

const LIST_PATTERN = /ดูโน้ต|ดู note|รายการโน้ต|โน้ตทั้งหมด|list note/i;

export async function notesAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userId, userName, groupId } = state;

  const action = LIST_PATTERN.test(userMessage) ? "list" : "add";
  log.info({ requestId: state.requestId, action, userMessage: userMessage.slice(0, 200) }, "Notes agent started");

  try {
    // Check if user wants to list notes
    if (LIST_PATTERN.test(userMessage)) {
      const notes = await listNotes(groupId);

      if (notes.length === 0) {
        return { replyText: "📝 ยังไม่มีโน้ตค่ะ" };
      }

      const lines = notes.map((n, i) => `${i + 1}. ${n.text} (โดย ${n.userName})`);
      return {
        replyText: `📝 โน้ตทั้งหมด:\n${lines.join("\n")}`,
      };
    }

    // Otherwise, add a note
    // Extract the note content by removing trigger words
    let noteText = userMessage
      .replace(/จดไว้ด้วย|จดไว้|จดด้วย|จด|โน้ต|memo|บันทึก/gi, "")
      .trim();

    if (!noteText) {
      return { replyText: "บอกสิ่งที่จะจดด้วยนะคะ เช่น 'จดไว้ด้วย ซื้อนม'" };
    }

    await addNote(noteText, userId, userName, groupId);

    return {
      replyText: `📝 จดไว้แล้วค่ะ: "${noteText}"`,
    };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Notes agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้จดไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
