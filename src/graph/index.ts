import { StateGraph, START, END } from "@langchain/langgraph";
import { BotStateAnnotation } from "./state.js";
import { supervisorNode } from "./supervisor.js";
import { calendarAgent } from "../nodes/calendar.agent.js";
import { notesAgent } from "../nodes/notes.agent.js";
import { reminderAgent } from "../nodes/reminder.agent.js";
import { homeworkAgent } from "../nodes/homework.agent.js";
import { chatAgent } from "../nodes/chat.agent.js";

export function buildGraph() {
  const graph = new StateGraph(BotStateAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("calendar_agent", calendarAgent)
    .addNode("notes_agent", notesAgent)
    .addNode("reminder_agent", reminderAgent)
    .addNode("homework_agent", homeworkAgent)
    .addNode("chat_agent", chatAgent)
    .addEdge(START, "supervisor")
    .addEdge("calendar_agent", END)
    .addEdge("notes_agent", END)
    .addEdge("reminder_agent", END)
    .addEdge("homework_agent", END)
    .addEdge("chat_agent", END)
    .addConditionalEdges(
      "supervisor",
      (state) => state.routedTo,
      {
        calendar_agent: "calendar_agent",
        notes_agent: "notes_agent",
        reminder_agent: "reminder_agent",
        homework_agent: "homework_agent",
        chat_agent: "chat_agent",
      },
    );

  return graph.compile();
}

let compiledGraph: ReturnType<typeof buildGraph> | null = null;

export function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}
