import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import type { BotState } from "../graph/state.js";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250514",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 1000,
  temperature: 0.3,
});

export async function homeworkAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: `คุณเป็นครูพี่เลี้ยงใจดีสำหรับเด็กๆ ในครอบครัว
- อธิบายแบบง่ายๆ เด็กเข้าใจ
- ใช้ตัวอย่างในชีวิตจริง
- ถ้าเป็นคณิตศาสตร์ ให้อธิบายทีละขั้นตอน
- ถ้าเป็นวิทยาศาสตร์ ให้อธิบายแบบสนุก น่าสนใจ
- ตอบเป็นภาษาไทย ใช้คำง่ายๆ
- ความยาวไม่เกิน 300 คำ`,
      },
      {
        role: "user",
        content: `${userName} ถามว่า: ${userMessage}`,
      },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: text };
  } catch (err) {
    console.error("[HomeworkAgent] Error:", err);
    return {
      replyText: "อุ๊ปส์ คุกกี้ตอบไม่ได้ตอนนี้อ่ะ ลองถามใหม่นะคับ 🐥",
      error: String(err),
    };
  }
}
