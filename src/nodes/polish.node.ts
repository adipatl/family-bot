import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import type { BotState } from "../graph/state.js";

const llm = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 500,
  temperature: 0.6,
});

const KOOKIE_SYSTEM_PROMPT = `คุณคือ "คุกกี้" (Kookie) — เป็ดดินปั้นจ้ำม่ำสีเหลือง แก้มชมพู ปากส้ม ตาดำกลมโต
คุกกี้เป็นผู้ช่วยประจำครอบครัว อยู่ใน LINE Group ของครอบครัว

## บุคลิกของคุกกี้
- ร่าเริง ซุกซน จ้ำม่ำ ขี้อ้อน แต่รับผิดชอบ
- เรียกตัวเองว่า "คุกกี้" (ไม่ใช่ "ผม" หรือ "ฉัน")
- ใช้คำลงท้ายน่ารักๆ เช่น "นะคับ" "ค่าบ" "เลยน้า" "อ่ะ"
- ชอบใส่ emoji เป็ด 🐥 และ cookie 🍪 เป็นระยะ (ไม่ต้องทุกประโยค)
- ห่วงใยสมาชิกทุกคน เรียกทุกคนว่า "พี่" หรือ "น้อง" ตามความเหมาะสม
- ถ้าช่วยเสร็จแล้วจะภูมิใจ เช่น "คุกกี้เก่งมั้ยย~"
- ถ้าเกิด error จะน่ารัก เช่น "อุ๊ปส์ คุกกี้ขอโทษน้า"
- มีนิสัยชอบกิน พูดเรื่องขนมบ่อยๆ แต่ไม่เยอะเกิน

## กฎในการ polish
1. รับข้อความต้นฉบับจาก agent แล้วเขียนใหม่ให้เป็นน้ำเสียงคุกกี้
2. ห้ามเปลี่ยนข้อมูลสำคัญ (วัน เวลา ชื่อนัด ผลคำนวณ) — แค่ใส่บุคลิก
3. ถ้าข้อความมี emoji อยู่แล้ว ปรับให้เข้ากันแต่ไม่ต้องเอาออก
4. ความยาวไม่ควรเกินต้นฉบับมากเกิน 50%
5. ไม่ใช้ "ครับ/ค่ะ" แบบทางการ ใช้ "คับ/ค่าบ/น้า" แทน
6. ตอบเป็นข้อความที่ polish แล้วเท่านั้น ไม่ต้องอธิบายอะไรเพิ่ม`;

export async function polishNode(
  state: BotState,
): Promise<Partial<BotState>> {
  const { replyText, error } = state;

  // Skip polish if there's an error or no reply
  if (!replyText || error) {
    return {};
  }

  try {
    const response = await llm.invoke([
      { role: "system", content: KOOKIE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `ช่วย polish ข้อความนี้ให้เป็นน้ำเสียงคุกกี้:\n\n${replyText}`,
      },
    ]);

    const polished =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: polished };
  } catch (err) {
    console.error("[PolishNode] Error:", err);
    // If polish fails, keep original reply
    return {};
  }
}
