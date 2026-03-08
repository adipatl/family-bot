import { addNote, listNotes, updateNote, deleteNote, deleteNotesByGroup } from "../services/firestore.service.js";
import type { BotState } from "../graph/state.js";
import { createLogger } from "../logger.js";
import { loadPrompt } from "../prompts/loader.js";
import { createLLM, invokeLLM } from "../llm.js";

const log = createLogger("notes-agent");

const llm = createLLM({ maxTokens: 512 });

export async function notesAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userId, userName, groupId } = state;

  log.info({ requestId: state.requestId, userMessage: userMessage.slice(0, 200) }, "Notes agent started");

  try {
    log.info({ requestId: state.requestId, prompt: "notes", userContent: userMessage.slice(0, 200) }, "LLM request");

    const { response, anthropicRequestId } = await invokeLLM(llm, [
      { role: "system", content: loadPrompt("notes") },
      { role: "user", content: userMessage },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    log.info({ requestId: state.requestId, anthropicRequestId, llmResponse: text.slice(0, 300) }, "Notes agent LLM response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { replyText: "ขอโทษค่ะ ไม่เข้าใจว่าจะทำอะไรกับโน้ต ลองบอกใหม่นะคะ" };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    log.info({ requestId: state.requestId, action: parsed.action, confidence: parsed.confidence }, "Notes parsed intent");

    // --- ADD ---
    if (parsed.action === "add") {
      const noteText = parsed.noteText?.trim();
      if (!noteText) {
        return { replyText: "บอกสิ่งที่จะจดด้วยนะคะ เช่น 'จดไว้ด้วย ซื้อนม'" };
      }
      await addNote(noteText, userId, userName, groupId);
      return { replyText: `📝 จดไว้แล้วค่ะ: "${noteText}"` };
    }

    // --- LIST ---
    if (parsed.action === "list") {
      const notes = await listNotes(groupId);
      if (notes.length === 0) {
        return { replyText: "📝 ยังไม่มีโน้ตค่ะ" };
      }
      const lines = notes.map((n, i) => `${i + 1}. ${n.text} (โดย ${n.userName})`);
      return { replyText: `📝 โน้ตทั้งหมด:\n${lines.join("\n")}` };
    }

    // --- UPDATE ---
    if (parsed.action === "update") {
      const newText = parsed.noteText?.trim();
      if (!newText || !parsed.searchKeyword) {
        return { replyText: "บอกว่าจะแก้โน้ตไหนและแก้เป็นอะไรด้วยนะคะ เช่น 'แก้โน้ตซื้อนมเป็นซื้อไข่'" };
      }

      const notes = await listNotes(groupId, 50);
      const target = notes.find((n) =>
        n.text.includes(parsed.searchKeyword),
      );

      if (!target || !target.id) {
        return { replyText: `📝 ไม่เจอโน้ตที่มีคำว่า "${parsed.searchKeyword}" ค่ะ` };
      }

      await updateNote(target.id, newText);
      return { replyText: `📝 แก้โน้ตแล้วค่ะ: "${target.text}" → "${newText}"` };
    }

    // --- DELETE ---
    if (parsed.action === "delete") {
      if (parsed.deleteScope === "all") {
        const count = await deleteNotesByGroup(groupId);
        if (count === 0) {
          return { replyText: "📝 ไม่มีโน้ตให้ลบค่ะ" };
        }
        return { replyText: `📝 ลบโน้ตทั้งหมด ${count} รายการแล้วค่ะ` };
      }

      // Delete specific note
      if (!parsed.searchKeyword) {
        return { replyText: "บอกว่าจะลบโน้ตไหนด้วยนะคะ เช่น 'ลบโน้ตซื้อนม'" };
      }

      const notes = await listNotes(groupId, 50);

      // Support deleting by number (e.g. "ลบโน้ตอันที่ 2")
      const num = parseInt(parsed.searchKeyword, 10);
      let target;
      if (!isNaN(num) && num >= 1 && num <= notes.length) {
        target = notes[num - 1];
      } else {
        target = notes.find((n) => n.text.includes(parsed.searchKeyword));
      }

      if (!target || !target.id) {
        return { replyText: `📝 ไม่เจอโน้ตที่ตรงกับ "${parsed.searchKeyword}" ค่ะ` };
      }

      await deleteNote(target.id);
      return { replyText: `📝 ลบโน้ตแล้วค่ะ: "${target.text}"` };
    }

    // --- UNKNOWN ---
    return { replyText: "ไม่แน่ใจว่าจะทำอะไรกับโน้ตค่ะ ลองบอกใหม่นะคะ เช่น 'จดไว้ด้วย ซื้อนม' หรือ 'ดูโน้ต'" };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "Notes agent failed");
    return {
      replyText: "อุ๊ปส์ คุกกี้จดไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
