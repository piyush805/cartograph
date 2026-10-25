import { Graph, layout, type GraphLabel, type NodeLabel } from "@dagrejs/dagre";
import type { MapGraph } from "./graph.ts";

export interface Placed {
  x: number;
  y: number;
}

// Importers sit left of what they import. Nodes and edges go in sorted, since
// dagre's ordering heuristics depend on insertion order and the same data has
// to produce the same picture.
//
// Folders import each other in both directions often enough that cycle
// breaking decides the picture. The default depth-first breaker follows
// insertion order, which is alphabetical and so arbitrary; the greedy one
// reverses the fewest edges, which leaves widely-imported folders on the right.
// Edge spacing is tight because long edges become one spacer per layer.
export function layoutMap(graph: MapGraph): Map<string, Placed> {
  const g = new Graph<GraphLabel, NodeLabel, Record<string, never>>();
  g.setGraph({
    rankdir: "LR",
    acyclicer: "greedy",
    nodesep: 10,
    edgesep: 2,
    ranksep: 40,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of [...graph.nodes].sort((a, b) => cmp(a.id, b.id))) {
    g.setNode(node.id, { width: node.width, height: node.height });
  }
  const pairs = new Set(graph.edges.map((e) => `${e.source}\n${e.target}`));
  for (const pair of [...pairs].sort()) {
    const [source, target] = pair.split("\n");
    g.setEdge(source, target);
  }

  layout(g);

  // dagre places centres; React Flow positions top-left corners.
  const placed = new Map<string, Placed>();
  for (const node of graph.nodes) {
    const { x = 0, y = 0 } = g.node(node.id);
    placed.set(node.id, { x: x - node.width / 2, y: y - node.height / 2 });
  }
  return placed;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
