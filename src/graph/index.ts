import { StateGraph, START, END } from "@langchain/langgraph";
import { BotStateAnnotation } from "./state.js";
import { supervisorNode } from "./supervisor.js";
import { calendarAgent } from "../nodes/calendar.agent.js";
import { reminderAgent } from "../nodes/reminder.agent.js";
import { homeworkAgent } from "../nodes/homework.agent.js";
import { chatAgent } from "../nodes/chat.agent.js";
import { polishNode } from "../nodes/polish.node.js";

export function buildGraph() {
  const graph = new StateGraph(BotStateAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("calendar_agent", calendarAgent)
    .addNode("reminder_agent", reminderAgent)
    .addNode("homework_agent", homeworkAgent)
    .addNode("chat_agent", chatAgent)
    .addNode("polish", polishNode)
    .addEdge(START, "supervisor")
    // All agents → polish → END
    .addEdge("calendar_agent", "polish")
    .addEdge("reminder_agent", "polish")
    .addEdge("homework_agent", "polish")
    .addEdge("chat_agent", "polish")
    .addEdge("polish", END)
    .addConditionalEdges(
      "supervisor",
      (state) => state.routedTo,
      {
        calendar_agent: "calendar_agent",
        reminder_agent: "reminder_agent",
        homework_agent: "homework_agent",
        chat_agent: "chat_agent",
      },
    );

  return graph.compile();
}

const compiledGraph = buildGraph();

export function getGraph() {
  return compiledGraph;
}
