import { loadPrompt } from "../prompts/loader.js";
import { createLLM } from "../llm.js";
import type { BotState, AgentName } from "./state.js";
import { createLogger } from "../logger.js";

const log = createLogger("supervisor");

// --- Keyword patterns (Thai) ---

const KEYWORD_PATTERNS: { agent: AgentName; pattern: RegExp }[] = [
  {
    agent: "calendar_agent",
    pattern:
      /ปฏิทิน|นัดหมาย|ลงตาราง|วันนี้มี|พรุ่งนี้มี|มีนัด|ลงวัน|schedule|วันนี้วันอะไร|วันที่เท่าไหร่/i,
  },
  {
    agent: "notes_agent",
    pattern: /โน้ต|memo|บันทึก|จดไว้|ดูโน้ต|note/i,
  },
  {
    agent: "reminder_agent",
    pattern: /เตือน|remind|แจ้งเตือน|alarm|ตั้งเตือน/i,
  },
  {
    agent: "homework_agent",
    pattern:
      /การบ้าน|อธิบาย|สอนหน่อย|คำนวณ|เท่ากับ|homework|โจทย์|สมการ/i,
  },
];

// Ambiguous words that match multiple intents
const AMBIGUOUS_PATTERNS = /จด.*นัด|นัด.*จด|ลง.*นัด|เตือน.*นัด|นัด.*เตือน/i;

function classifyByKeyword(
  message: string,
): { agent: AgentName; confidence: number } | null {
  // If message contains ambiguous cross-agent patterns, skip to LLM
  if (AMBIGUOUS_PATTERNS.test(message)) {
    return null;
  }

  const matches: AgentName[] = [];
  for (const { agent, pattern } of KEYWORD_PATTERNS) {
    if (pattern.test(message)) {
      matches.push(agent);
    }
  }

  // Only trust keyword if exactly one agent matched
  if (matches.length === 1) {
    return { agent: matches[0], confidence: 0.9 };
  }

  // Multiple matches or zero → let LLM decide
  return null;
}

// --- LLM classification (fallback) ---

interface ClassifierResponse {
  agent: AgentName;
  confidence: "high" | "low";
  reasoning: string;
}

const VALID_AGENTS: AgentName[] = [
  "calendar_agent",
  "notes_agent",
  "reminder_agent",
  "homework_agent",
  "chat_agent",
];

const llm = createLLM({ maxTokens: 256 });

async function classifyByLLM(
  message: string,
): Promise<{ agent: AgentName; confidence: number; reasoning: string }> {
  log.info({ prompt: "supervisor", userContent: message.slice(0, 200) }, "LLM request");

  const response = await llm.invoke([
    { role: "system", content: loadPrompt("supervisor") },
    { role: "user", content: message },
  ]);

  const text =
    typeof response.content === "string"
      ? response.content.trim()
      : String(response.content);

  log.info({ llmResponse: text.slice(0, 300) }, "Supervisor LLM response");

  // Extract JSON from possible markdown code fences (e.g. ```json ... ```)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed: ClassifierResponse = JSON.parse(jsonMatch[0]);

      if (VALID_AGENTS.includes(parsed.agent)) {
        return {
          agent: parsed.agent,
          confidence: parsed.confidence === "high" ? 0.85 : 0.5,
          reasoning: parsed.reasoning ?? "",
        };
      }
    } catch {
      // JSON parse failed — try simple text matching as last resort
      const matched = VALID_AGENTS.find((a) => text.includes(a));
      if (matched) {
        return { agent: matched, confidence: 0.5, reasoning: "fallback-text-match" };
      }
    }
  }

  return { agent: "chat_agent", confidence: 0.3, reasoning: "no-match" };
}

// --- Supervisor node ---

export async function supervisorNode(
  state: BotState,
): Promise<Partial<BotState>> {
  const message = state.userMessage;

  // Tier 1: Keyword matching (free, fast, high confidence)
  const keywordResult = classifyByKeyword(message);
  if (keywordResult) {
    log.info(
      { requestId: state.requestId, userMessage: message.slice(0, 200), agent: keywordResult.agent, confidence: keywordResult.confidence, tier: "keyword" },
      "Routed",
    );
    return {
      routedTo: keywordResult.agent,
      confidence: keywordResult.confidence,
    };
  }

  // Tier 2: LLM classification (handles ambiguity)
  try {
    const llmResult = await classifyByLLM(message);
    log.info(
      { requestId: state.requestId, userMessage: message.slice(0, 200), agent: llmResult.agent, confidence: llmResult.confidence, reasoning: llmResult.reasoning, tier: "llm" },
      "Routed",
    );
    return {
      routedTo: llmResult.agent,
      confidence: llmResult.confidence,
    };
  } catch (err) {
    log.error({ requestId: state.requestId, err }, "LLM classification failed");
    return {
      routedTo: "chat_agent",
      confidence: 0.1,
    };
  }
}

/** Pre-establish TLS/HTTP2 connection to Anthropic API on startup. */
export function warmupSupervisor() {
  llm
    .invoke([{ role: "user", content: "hi" }])
    .then(() => log.info("Supervisor LLM warmed up"))
    .catch(() => log.warn("Supervisor LLM warmup failed"));
}