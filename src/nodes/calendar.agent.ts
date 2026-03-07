import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import { addEvent, getEvents } from "../services/calendar.service.js";
import type { BotState } from "../graph/state.js";

const llm = createLLM({ maxTokens: 1000 });

export async function calendarAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const today = new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    });

    const parseResponse = await llm.invoke([
      {
        role: "system",
        content: loadPrompt("calendar", { TODAY: today }),
      },
      { role: "user", content: userMessage },
    ]);

    const text =
      typeof parseResponse.content === "string"
        ? parseResponse.content
        : String(parseResponse.content);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { replyText: "ขอโทษค่ะ ไม่เข้าใจรายละเอียดนัดหมาย ลองบอกใหม่นะคะ" };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action === "date_info") {
      const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      const askedDate = new Date(`${parsed.date}T00:00:00+07:00`);
      const askedDateStr = askedDate.toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Bangkok",
      });

      let label: string;
      if (parsed.date === todayISO) {
        label = "วันนี้";
      } else {
        const tomorrowDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowISO = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
        label = parsed.date === tomorrowISO ? "พรุ่งนี้" : parsed.date;
      }

      return {
        replyText: `📅 ${label}คือ ${askedDateStr} ค่ะ`,
      };
    }

    if (parsed.action === "add") {
      const start = new Date(`${parsed.date}T${parsed.startTime}:00+07:00`);
      const end = new Date(`${parsed.date}T${parsed.endTime}:00+07:00`);

      await addEvent({
        summary: parsed.summary,
        start,
        end,
        description: `ลงโดย ${userName} ผ่าน LINE Bot`,
      });

      const dayStr = start.toLocaleDateString("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Bangkok",
      });
      const timeStr = start.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      });

      return {
        replyText: `✅ ลงปฏิทินแล้วค่ะ\n📅 ${parsed.summary}\n🗓 ${dayStr}\n⏰ ${timeStr}`,
      };
    }

    // Query events
    const dateMin = new Date(`${parsed.date}T00:00:00+07:00`);
    const dateMax = new Date(
      `${parsed.queryDateEnd ?? parsed.date}T23:59:59+07:00`,
    );

    const events = await getEvents(dateMin, dateMax);

    if (events.length === 0) {
      return { replyText: "📅 ไม่มีนัดหมายในวันที่ถามค่ะ" };
    }

    const lines = events.map((e) => {
      const time = e.start.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      });
      return `• ${time} — ${e.summary}`;
    });

    return {
      replyText: `📅 นัดหมาย:\n${lines.join("\n")}`,
    };
  } catch (err) {
    console.error("[CalendarAgent] Error:", err);
    return {
      replyText: "อุ๊ปส์ คุกกี้จัดการปฏิทินไม่ได้อ่ะ ลองใหม่อีกทีนะคับ 🐥",
      error: String(err),
    };
  }
}
