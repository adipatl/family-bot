import { getGraph } from "./index.js";

async function main() {
  const graph = getGraph();
  const diagram = graph.getGraph().drawMermaid();
  console.log(diagram);
}

main().catch(console.error);
