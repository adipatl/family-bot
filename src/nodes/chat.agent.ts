import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import type { BotState } from "../graph/state.js";

const llm = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  anthropicApiKey: config.anthropic.apiKey,
  maxTokens: 300,
  temperature: 0.7,
});

export async function chatAgent(
  state: BotState,
): Promise<Partial<BotState>> {
  const { userMessage, userName } = state;

  try {
    const response = await llm.invoke([
      {
        role: "system",
        content: `คุณชื่อ "น้องบ้าน" เป็นบอทประจำครอบครัว
- ตอบสั้นๆ กระชับ น่ารัก เป็นกันเอง
- ใช้ภาษาไทยธรรมชาติ
- ถ้าคนทักทาย ก็ทักกลับอย่างอบอุ่น
- ถ้าคนคุยเล่น ก็ร่วมสนุกด้วย
- ความยาวไม่เกิน 2-3 ประโยค`,
      },
      {
        role: "user",
        content: `${userName}: ${userMessage}`,
      },
    ]);

    const text =
      typeof response.content === "string"
        ? response.content
        : String(response.content);

    return { replyText: text };
  } catch (err) {
    console.error("[ChatAgent] Error:", err);
    return {
      replyText: "สวัสดีค่ะ น้องบ้านพร้อมช่วยเสมอนะคะ 😊",
      error: String(err),
    };
  }
}
