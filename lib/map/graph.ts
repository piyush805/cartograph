// What the map shows for a given set of open folders: nodes sized for layout,
// and edges between whatever currently represents each file. Pure, so the same
// folding, open set and scroll windows always produce the same graph.

import type { Folding } from "./fold.ts";
import { shortestUnique } from "./labels.ts";

export interface MapFile {
  path: string;
  folder: string;
  fanIn: number;
  fanOut: number;
}

export interface FileLink {
  from: string;
  to: string;
}

export interface MapRow {
  path: string;
  label: string;
  fanIn: number;
}

// A type alias rather than an interface so it satisfies React Flow's
// Record<string, unknown> constraint on node data.
type NodeBase = {
  id: string;
  label: string;
  files: number;
  // Distinct files outside this folder that import into it / that it imports.
  fanIn: number;
  fanOut: number;
  width: number;
  height: number;
};

export type PanelWindow = {
  // Index of the first row in view, and how many rows fit.
  start: number;
  visible: number;
};

export type MapNode =
  | (NodeBase & { kind: "folder" })
  | (NodeBase & { kind: "panel"; rows: MapRow[]; window: PanelWindow });

export interface MapEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  // The files this edge stands for at each end, so a file stays traceable
  // even when it's folded away or scrolled out of its panel.
  sources: string[];
  targets: string[];
}

export interface MapGraph {
  nodes: MapNode[];
  edges: MapEdge[];
}

// Pixel sizes the node components render at. Layout runs before anything is
// in the DOM, so these have to match the CSS exactly. Widths come from
// character counts, which is exact because labels are monospace.
export const size = {
  mono12: 7.2,
  mono11: 6.6,
  padX: 10,
  gap: 10,
  border: 1,
  // Label line and file-count line.
  folderMinHeight: 38,
  folderMaxHeight: 120,
  headerHeight: 42,
  rowHeight: 20,
  panelRows: 12,
  panelPadY: 4,
  panelMinWidth: 180,
  scrollbar: 12,
} as const;

// Edges attach to rows in view. Files scrolled above the window attach to the
// header and files below it to the footer, because React Flow measures handle
// positions once and doesn't follow a scroll.
export const handle = {
  in: "in",
  out: "out",
  rowIn: (path: string) => `row-in:${path}`,
  rowOut: (path: string) => `row-out:${path}`,
  aboveIn: "above-in",
  aboveOut: "above-out",
  belowIn: "below-in",
  belowOut: "below-out",
} as const;

export const ROOT_LABEL = "(root)";

export function distinctLinks(edges: readonly FileLink[]): FileLink[] {
  const seen = new Set<string>();
  const links: FileLink[] = [];
  for (const { from, to } of edges) {
    const key = `${from}\n${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ from, to });
  }
  return links.sort((a, b) => compare(`${a.from}\n${a.to}`, `${b.from}\n${b.to}`));
}

export function filesLabel(count: number): string {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

export function panelStats(node: NodeBase): string {
  return `${filesLabel(node.files)}  in ${node.fanIn}  out ${node.fanOut}`;
}

export function outOfView(rows: number, window: PanelWindow) {
  const above = window.start;
  return { above, below: rows - above - window.visible };
}

export function buildMap(
  folding: Folding,
  files: readonly MapFile[],
  links: readonly FileLink[],
  open: ReadonlySet<string>,
  // First row in view per open folder; missing means scrolled to the top.
  starts: ReadonlyMap<string, number> = new Map(),
): MapGraph {
  const groupOf = new Map<string, string>();
  for (const group of folding.groups) {
    for (const path of group.files) groupOf.set(path, group.dir);
  }
  const fileFanIn = new Map(files.map((f) => [f.path, f.fanIn]));

  const importers = new Map<string, Set<string>>();
  const imported = new Map<string, Set<string>>();
  const crossing: FileLink[] = [];
  for (const link of links) {
    const from = groupOf.get(link.from);
    const to = groupOf.get(link.to);
    if (from === undefined || to === undefined || from === to) continue;
    crossing.push(link);
    addTo(importers, to, link.from);
    addTo(imported, from, link.to);
  }

  // Scaled against the busiest folder in the whole folding, not just what's
  // on screen, so opening a panel never resizes the nodes around it.
  const maxFanIn = Math.max(
    1,
    ...folding.groups.map((g) => importers.get(g.dir)?.size ?? 0),
  );

  const labels = shortestUnique(folding.groups.map((g) => g.dir));
  // Row index within its panel, for every file in an open folder.
  const rowIndex = new Map<string, number>();
  const windows = new Map<string, PanelWindow>();

  const nodes: MapNode[] = folding.groups.map((group) => {
    const base = {
      id: group.dir,
      label: group.dir === "." ? ROOT_LABEL : labels.get(group.dir)!,
      files: group.files.length,
      fanIn: importers.get(group.dir)?.size ?? 0,
      fanOut: imported.get(group.dir)?.size ?? 0,
    };

    if (!open.has(group.dir)) {
      const width = Math.ceil(
        size.padX * 2 +
          size.border * 2 +
          Math.max(
            base.label.length * size.mono12,
            filesLabel(base.files).length * size.mono11,
          ),
      );
      const scale = Math.sqrt(base.fanIn / maxFanIn);
      const height = Math.round(
        size.folderMinHeight +
          (size.folderMaxHeight - size.folderMinHeight) * scale,
      );
      return { ...base, kind: "folder", width, height };
    }

    // The rows worth seeing first are the ones most depended on.
    const ordered = [...group.files].sort(
      (a, b) =>
        (fileFanIn.get(b) ?? 0) - (fileFanIn.get(a) ?? 0) || compare(a, b),
    );
    ordered.forEach((path, index) => rowIndex.set(path, index));
    // Labelled against every row, not just those in view, so scrolling never
    // relabels a file.
    const rowLabels = shortestUnique(ordered);
    const rows = ordered.map((path) => ({
      path,
      label: rowLabels.get(path)!,
      fanIn: fileFanIn.get(path) ?? 0,
    }));
    const visible = Math.min(size.panelRows, rows.length);
    const scrolls = rows.length > visible;
    const start = Math.min(
      Math.max(0, starts.get(group.dir) ?? 0),
      rows.length - visible,
    );
    const window = { start, visible };
    windows.set(group.dir, window);

    const contentWidth = Math.max(
      base.label.length * size.mono12,
      panelStats({ ...base, width: 0, height: 0 }).length * size.mono11,
      ...rows.map(
        (row) =>
          (row.label.length + String(row.fanIn).length) * size.mono11 +
          size.gap,
      ),
    );
    const width = Math.max(
      size.panelMinWidth,
      Math.ceil(
        contentWidth +
          size.padX * 2 +
          size.border * 2 +
          (scrolls ? size.scrollbar : 0),
      ),
    );
    const height =
      size.headerHeight +
      (visible + (scrolls ? 1 : 0)) * size.rowHeight +
      size.panelPadY * 2 +
      size.border * 2;
    return { ...base, kind: "panel", rows, window, width, height };
  });

  const endpoint = (path: string, side: "source" | "target") => {
    const node = groupOf.get(path)!;
    const window = windows.get(node);
    const source = side === "source";
    if (!window) return { node, handle: source ? handle.out : handle.in };
    const index = rowIndex.get(path)!;
    if (index < window.start) {
      return { node, handle: source ? handle.aboveOut : handle.aboveIn };
    }
    if (index >= window.start + window.visible) {
      return { node, handle: source ? handle.belowOut : handle.belowIn };
    }
    return { node, handle: source ? handle.rowOut(path) : handle.rowIn(path) };
  };

  const edges = new Map<
    string,
    Omit<MapEdge, "sources" | "targets"> & {
      sources: Set<string>;
      targets: Set<string>;
    }
  >();
  for (const link of crossing) {
    const source = endpoint(link.from, "source");
    const target = endpoint(link.to, "target");
    const id = `${source.node}|${source.handle}->${target.node}|${target.handle}`;
    const existing = edges.get(id);
    if (existing) {
      existing.sources.add(link.from);
      existing.targets.add(link.to);
      continue;
    }
    edges.set(id, {
      id,
      source: source.node,
      sourceHandle: source.handle,
      target: target.node,
      targetHandle: target.handle,
      sources: new Set([link.from]),
      targets: new Set([link.to]),
    });
  }

  return {
    nodes,
    edges: [...edges.values()]
      .map((edge) => ({
        ...edge,
        sources: [...edge.sources].sort(),
        targets: [...edge.targets].sort(),
      }))
      .sort((a, b) => compare(a.id, b.id)),
  };
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
