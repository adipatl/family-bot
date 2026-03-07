import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config/index.js";
import type { BotState, AgentName } from "./state.js";

// --- Keyword patterns (Thai) ---

const KEYWORD_PATTERNS: { agent: AgentName; pattern: RegExp }[] = [
  {
    agent: "calendar_agent",
    pattern:
      /ปฏิทิน|นัด|ลงตาราง|กี่โมง|วันไหน|ไปหาหมอ|นัดหมาย|ตาราง|วันนี้มี|พรุ่งนี้มี|มีนัด|ลงวัน|schedule/i,
  },
  {
    agent: "notes_agent",
    pattern: /จด|โน้ต|memo|บันทึก|จดไว้|ดูโน้ต|note|รายการ/i,
  },
  {
    agent: "reminder_agent",
    pattern: /เตือน|remind|แจ้งเตือน|alarm|ตั้งเตือน|เช็ค reminder/i,
  },
  {
    agent: "homework_agent",
    pattern:
      /การบ้าน|อธิบาย|สอน|คำนวณ|เท่ากับ|homework|โจทย์|สมการ|แก้สมการ|คูณ|หาร|บวก|ลบ|เลขยกกำลัง/i,
  },
];

function classifyByKeyword(
  message: string,
): { agent: AgentName; confidence: number } | null {
  for (const { agent, pattern } of KEYWORD_PATTERNS) {
    if (pattern.test(message)) {
      return { agent, confidence: 0.9 };
    }
  }
  return null;
}

// --- LLM classification (fallback) ---

async function classifyByLLM(
  message: string,
): Promise<{ agent: AgentName; confidence: number }> {
  const llm = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    anthropicApiKey: config.anthropic.apiKey,
    maxTokens: 100,
    temperature: 0,
  });

  const response = await llm.invoke([
    {
      role: "system",
      content: `คุณเป็น classifier สำหรับ family bot ภาษาไทย
จัดประเภทข้อความผู้ใช้เป็นหนึ่งใน:
- calendar_agent: เรื่องปฏิทิน นัดหมาย ตาราง วัน เวลา
- notes_agent: จดบันทึก โน้ต memo รายการ
- reminder_agent: ตั้งเตือน แจ้งเตือน alarm
- homework_agent: ถามการบ้าน อธิบายเรื่องเรียน คำนวณ วิทยาศาสตร์
- chat_agent: คุยเล่น ทักทาย ไม่เข้าหมวดไหน

ตอบเฉพาะชื่อ agent เท่านั้น ไม่ต้องอธิบาย`,
    },
    { role: "user", content: message },
  ]);

  const text =
    typeof response.content === "string"
      ? response.content.trim()
      : String(response.content);

  const validAgents: AgentName[] = [
    "calendar_agent",
    "notes_agent",
    "reminder_agent",
    "homework_agent",
    "chat_agent",
  ];
  const matched = validAgents.find((a) => text.includes(a));

  return {
    agent: matched ?? "chat_agent",
    confidence: matched ? 0.7 : 0.3,
  };
}

// --- Supervisor node ---

export async function supervisorNode(
  state: BotState,
): Promise<Partial<BotState>> {
  const message = state.userMessage;

  // Tier 1: Keyword matching (free, fast)
  const keywordResult = classifyByKeyword(message);
  if (keywordResult) {
    console.log(
      `[Supervisor] Keyword match → ${keywordResult.agent} (${keywordResult.confidence})`,
    );
    return {
      routedTo: keywordResult.agent,
      confidence: keywordResult.confidence,
    };
  }

  // Tier 2: LLM classification (fallback)
  try {
    const llmResult = await classifyByLLM(message);
    console.log(
      `[Supervisor] LLM classify → ${llmResult.agent} (${llmResult.confidence})`,
    );
    return {
      routedTo: llmResult.agent,
      confidence: llmResult.confidence,
    };
  } catch (err) {
    console.error("[Supervisor] LLM classification failed:", err);
    return {
      routedTo: "chat_agent",
      confidence: 0.1,
    };
  }
}
