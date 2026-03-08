import { Annotation } from "@langchain/langgraph";

export const AgentNames = [
  "calendar_agent",
  "reminder_agent",
  "homework_agent",
  "chat_agent",
] as const;

export type AgentName = (typeof AgentNames)[number];

export const BotStateAnnotation = Annotation.Root({
  // Inputs (set by webhook handler)
  userMessage: Annotation<string>,
  userName: Annotation<string>,
  userId: Annotation<string>,
  groupId: Annotation<string>,
  requestId: Annotation<string>,
  language: Annotation<"th" | "en">,

  // Routing (set by supervisor)
  routedTo: Annotation<AgentName>,
  confidence: Annotation<number>,

  // Output (set by agent nodes)
  replyText: Annotation<string>,
  error: Annotation<string | null>,
});

export type BotState = typeof BotStateAnnotation.State;
