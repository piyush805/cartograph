// What stays at full strength while something is selected: the selection, the
// edges touching it, and whatever sits at the far end of those edges. Pure over
// the graph that's on screen, so it only ever lights up drawn edges.

import type { MapGraph } from "./graph.ts";

export type Selection =
  | { kind: "folder"; dir: string }
  | { kind: "file"; dir: string; path: string };

export type Direction = "incoming" | "outgoing";

export interface Highlight {
  edges: Map<string, Direction>;
  // `${node}|${handle}` for both ends of every lit edge, so a panel can light
  // single rows, and the header or footer when a lit file is scrolled away.
  endpoints: Set<string>;
  nodes: Set<string>;
}

export function endpointKey(node: string, handleId: string): string {
  return `${node}|${handleId}`;
}

export function highlight(graph: MapGraph, selection: Selection): Highlight {
  // Matched by file rather than by handle, so a selected file keeps its edges
  // when it's scrolled out of its panel and they reroute to the header/footer.
  const fromSelection = (edge: MapGraph["edges"][number]) =>
    selection.kind === "folder"
      ? edge.source === selection.dir
      : edge.sources.includes(selection.path);
  const toSelection = (edge: MapGraph["edges"][number]) =>
    selection.kind === "folder"
      ? edge.target === selection.dir
      : edge.targets.includes(selection.path);

  const edges = new Map<string, Direction>();
  const endpoints = new Set<string>();
  const nodes = new Set<string>([selection.dir]);

  for (const edge of graph.edges) {
    const outgoing = fromSelection(edge);
    if (!outgoing && !toSelection(edge)) continue;
    edges.set(edge.id, outgoing ? "outgoing" : "incoming");
    endpoints.add(endpointKey(edge.source, edge.sourceHandle));
    endpoints.add(endpointKey(edge.target, edge.targetHandle));
    nodes.add(edge.source);
    nodes.add(edge.target);
  }
  return { edges, endpoints, nodes };
}
