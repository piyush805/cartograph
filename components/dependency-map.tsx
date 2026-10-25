"use client";

import "@xyflow/react/dist/base.css";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Folding } from "@/lib/map/fold";
import {
  buildMap,
  filesLabel,
  handle,
  outOfView,
  size,
  type FileLink,
  type MapFile,
  type MapNode,
} from "@/lib/map/graph";
import {
  endpointKey,
  highlight,
  type Highlight,
  type Selection,
} from "@/lib/map/highlight";
import { layoutMap } from "@/lib/map/layout";

type FolderData = Extract<MapNode, { kind: "folder" }>;
type PanelData = Extract<MapNode, { kind: "panel" }>;
type FolderNodeType = Node<FolderData, "folder">;
type PanelNodeType = Node<PanelData, "panel">;

const FIT_PADDING = 0.06;

// React Flow sets pointer-events: none on a node that is neither selectable,
// draggable nor given an onNodeClick, which swallows clicks on the buttons
// inside it. Node style is applied after that default, so this overrides it.
const interactive = { pointerEvents: "all" } as const;

// Above every edge layer, including the raised one for lit edges, so edges run
// behind folders and panels instead of across their rows.
const NODE_Z = 10;

interface MapState {
  selection: Selection | null;
  hover: Selection | null;
  lit: Highlight | null;
  toggle: (dir: string) => void;
  selectFile: (dir: string, path: string) => void;
  scrollPanel: (dir: string, start: number) => void;
  setHover: (hover: Selection | null) => void;
}

const MapContext = createContext<MapState>({
  selection: null,
  hover: null,
  lit: null,
  toggle: () => {},
  selectFile: () => {},
  scrollPanel: () => {},
  setHover: () => {},
});

// A file's row is hovered by itself; a folded folder stands in for every file
// inside it, so hovering one of those in the pane lights the folder.
function hoversFolder(hover: Selection | null, dir: string, open: boolean) {
  return hover !== null && hover.dir === dir && (!open || hover.kind === "folder");
}

const hoverRing = "ring-1 ring-inset ring-accent";

const hiddenHandle = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  background: "transparent",
} as const;

// Green and amber are the same incoming/outgoing colours the panel header uses
// for fan-in and fan-out; they only appear on edges touching the selection.
function edgeLook(colour: string, opacity: number, width: number) {
  return {
    style: { stroke: colour, strokeOpacity: opacity, strokeWidth: width },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 10,
      height: 10,
      color: colour,
    },
  };
}

const edgeLooks = {
  normal: edgeLook("var(--muted)", 0.5, 0.75),
  dim: { ...edgeLook("var(--muted)", 0.08, 0.75), zIndex: 0 },
  incoming: { ...edgeLook("var(--incoming)", 1, 1), zIndex: 1 },
  outgoing: { ...edgeLook("var(--outgoing)", 1, 1), zIndex: 1 },
};

const nodeTypes: NodeTypes = { folder: FolderNode, panel: PanelNode };

interface MapProps {
  files: readonly MapFile[];
  links: readonly FileLink[];
  folding: Folding;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  hover: Selection | null;
  onHover: (hover: Selection | null) => void;
}

export function DependencyMap(props: MapProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  files,
  links,
  folding,
  selection,
  onSelect,
  hover,
  onHover,
}: MapProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [starts, setStarts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  // A file selected from the pane may sit in a folded folder. Opening it in
  // the same render keeps the selection visible, and the refit below then
  // brings the new panel into view.
  const [revealed, setRevealed] = useState(selection);
  if (revealed !== selection) {
    setRevealed(selection);
    if (selection?.kind === "file" && !open.has(selection.dir)) {
      setOpen(new Set(open).add(selection.dir));
    }
  }

  // Layout reads the graph at its unscrolled state. Scrolling only reroutes
  // edges within a panel, so it never re-runs dagre or moves a node.
  const placed = useMemo(
    () => layoutMap(buildMap(folding, files, links, open)),
    [folding, files, links, open],
  );

  const { graph, nodes } = useMemo(() => {
    const graph = buildMap(folding, files, links, open, starts);
    const nodes = graph.nodes.map(
      (node): FolderNodeType | PanelNodeType =>
        node.kind === "folder"
          ? {
              id: node.id,
              type: "folder",
              position: placed.get(node.id)!,
              width: node.width,
              height: node.height,
              style: interactive,
              zIndex: NODE_Z,
              data: node,
            }
          : {
              id: node.id,
              type: "panel",
              position: placed.get(node.id)!,
              width: node.width,
              height: node.height,
              style: interactive,
              zIndex: NODE_Z,
              data: node,
            },
    );
    return { graph, nodes };
  }, [folding, files, links, open, starts, placed]);

  // Kept apart from layout so selecting never re-runs dagre or moves a node.
  const lit = useMemo(
    () => (selection ? highlight(graph, selection) : null),
    [graph, selection],
  );
  const edges = useMemo(
    () =>
      graph.edges.map(
        (edge): Edge => ({
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
          ...(lit ? edgeLooks[lit.edges.get(edge.id) ?? "dim"] : edgeLooks.normal),
        }),
      ),
    [graph, lit],
  );

  // Opening a folder selects it, since a click can't both open and select a
  // folded node. Closing drops a selection that lived inside it.
  const toggle = useCallback(
    (dir: string) => {
      const next = new Set(open);
      if (next.has(dir)) {
        next.delete(dir);
        if (selection?.dir === dir) onSelect(null);
        setStarts((current) => {
          if (!current.has(dir)) return current;
          const rest = new Map(current);
          rest.delete(dir);
          return rest;
        });
      } else {
        next.add(dir);
        onSelect({ kind: "folder", dir });
      }
      setOpen(next);
    },
    [open, selection, onSelect],
  );

  const selectFile = useCallback(
    (dir: string, path: string) => {
      onSelect(
        selection?.kind === "file" && selection.path === path
          ? null
          : { kind: "file", dir, path },
      );
    },
    [selection, onSelect],
  );

  const scrollPanel = useCallback((dir: string, start: number) => {
    setStarts((current) =>
      current.get(dir) === start ? current : new Map(current).set(dir, start),
    );
  }, []);

  const state = useMemo(
    () => ({
      selection,
      hover,
      lit,
      toggle,
      selectFile,
      scrollPanel,
      setHover: onHover,
    }),
    [selection, hover, lit, toggle, selectFile, scrollPanel, onHover],
  );

  // Runs after the render that carries the new panel, so the fit measures the
  // graph with it open. Capping maxZoom at the current zoom means a refit can
  // pan and zoom out but never zoom in on the panel and lose the rest.
  const { fitView, getZoom } = useReactFlow();
  const openCount = useRef(0);
  useEffect(() => {
    const opened = open.size > openCount.current;
    openCount.current = open.size;
    if (opened) void fitView({ padding: FIT_PADDING, maxZoom: getZoom() });
  }, [open, fitView, getZoom]);

  return (
    <MapContext value={state}>
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onPaneClick={() => onSelect(null)}
          fitView
          fitViewOptions={{ padding: FIT_PADDING, maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          zoomOnDoubleClick={false}
        />
      </div>
    </MapContext>
  );
}

function FolderNode({ data }: NodeProps<FolderNodeType>) {
  const { toggle, lit, hover, setHover } = use(MapContext);
  const hovered = hoversFolder(hover, data.id, false);
  const dimmed = !hovered && lit !== null && !lit.nodes.has(data.id);
  return (
    <div className={`size-full ${dimmed ? "opacity-25" : ""}`}>
      <button
        type="button"
        title={data.id}
        aria-expanded={false}
        onClick={() => toggle(data.id)}
        onMouseEnter={() => setHover({ kind: "folder", dir: data.id })}
        onMouseLeave={() => setHover(null)}
        className={`flex size-full flex-col justify-center border bg-surface text-left ${
          hovered ? `border-accent ${hoverRing}` : "border-line hover:border-ink"
        }`}
        style={{ paddingInline: size.padX }}
      >
        <span className="whitespace-nowrap font-mono text-[12px] leading-4">
          {data.label}
        </span>
        <span className="whitespace-nowrap font-mono text-[11px] leading-[14px] text-muted tabular-nums">
          {filesLabel(data.files)}
        </span>
      </button>
      <Handle
        type="target"
        id={handle.in}
        position={Position.Left}
        isConnectable={false}
        style={hiddenHandle}
      />
      <Anchors inId={handle.in} outId={handle.out} />
    </div>
  );
}

function PanelNode({ id, data }: NodeProps<PanelNodeType>) {
  const { toggle, selectFile, scrollPanel, selection, lit, hover, setHover } =
    use(MapContext);
  const panelSelected =
    selection?.kind === "folder" && selection.dir === data.id;
  const headerHovered = hoversFolder(hover, data.id, true);
  const touched =
    lit === null ||
    lit.nodes.has(data.id) ||
    hover?.dir === data.id;
  const anchorLit = (inId: string, outId: string) =>
    lit === null ||
    panelSelected ||
    lit.endpoints.has(endpointKey(data.id, inId)) ||
    lit.endpoints.has(endpointKey(data.id, outId));

  const { start, visible } = data.window;
  const { above, below } = outOfView(data.rows.length, data.window);
  const scrolls = data.rows.length > visible;

  // Handles move with the scroll but React Flow only measures them on demand,
  // so the panel asks for a re-measure whenever the rows in view change.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, start, updateNodeInternals]);

  // A file selected from the pane can be scrolled out of its panel. Runs only
  // when the selection changes, so scrolling a selected row away by hand
  // stays put.
  const list = useRef<HTMLUListElement>(null);
  const selectedIndex =
    selection?.kind === "file"
      ? data.rows.findIndex((row) => row.path === selection.path)
      : -1;
  const rowCount = data.rows.length;
  useEffect(() => {
    const element = list.current;
    if (selectedIndex < 0 || !element) return;
    const top = Math.round(element.scrollTop / size.rowHeight);
    if (selectedIndex >= top && selectedIndex < top + visible) return;
    element.scrollTop =
      Math.min(selectedIndex, rowCount - visible) * size.rowHeight;
  }, [selectedIndex, visible, rowCount]);

  return (
    <div
      className={`flex size-full flex-col border bg-surface ${
        panelSelected ? "border-accent" : "border-ink"
      } ${touched ? "" : "opacity-25"}`}
    >
      <div className="relative shrink-0">
        <button
          type="button"
          title={data.id}
          aria-expanded
          onClick={() => toggle(data.id)}
          onMouseEnter={() => setHover({ kind: "folder", dir: data.id })}
          onMouseLeave={() => setHover(null)}
          className={`flex w-full flex-col justify-center border-b border-line bg-canvas text-left hover:bg-surface ${
            headerHovered ? hoverRing : ""
          }`}
          style={{ height: size.headerHeight, paddingInline: size.padX }}
        >
          <span className="whitespace-nowrap font-mono text-[12px] font-medium leading-4">
            {data.label}
          </span>
          <span className="whitespace-pre font-mono text-[11px] leading-[14px] text-muted tabular-nums">
            {filesLabel(data.files)}
            {"  in "}
            <span className="text-incoming">{data.fanIn}</span>
            {"  out "}
            <span className="text-outgoing">{data.fanOut}</span>
          </span>
        </button>
        <Anchors inId={handle.aboveIn} outId={handle.aboveOut} />
      </div>
      <div style={{ paddingBlock: size.panelPadY }}>
        {/* nowheel keeps the wheel scrolling the list instead of zooming the
            map. Snapping keeps the scroll on whole rows, so the rows in view
            are exactly the ones the edges were routed to. */}
        <ul
          ref={list}
          onScroll={(event) =>
            scrollPanel(
              data.id,
              Math.round(event.currentTarget.scrollTop / size.rowHeight),
            )
          }
          className={`nowheel snap-y snap-mandatory ${
            scrolls ? "overflow-y-scroll [scrollbar-width:thin]" : ""
          }`}
          style={{ height: visible * size.rowHeight }}
        >
          {data.rows.map((row, index) => {
            const inView = index >= start && index < start + visible;
            const inId = handle.rowIn(row.path);
            const outId = handle.rowOut(row.path);
            const selected =
              selection?.kind === "file" && selection.path === row.path;
            const rowHovered =
              hover?.kind === "file" && hover.path === row.path;
            return (
              <li
                key={row.path}
                className={`relative snap-start font-mono text-[11px] ${
                  selected || rowHovered || anchorLit(inId, outId)
                    ? ""
                    : "opacity-25"
                }`}
                style={{ height: size.rowHeight }}
              >
                <button
                  type="button"
                  title={row.path}
                  aria-pressed={selected}
                  onClick={() => selectFile(data.id, row.path)}
                  onMouseEnter={() =>
                    setHover({ kind: "file", dir: data.id, path: row.path })
                  }
                  onMouseLeave={() => setHover(null)}
                  className={`flex size-full items-center justify-between text-left ${
                    selected ? "bg-accent/15" : "hover:bg-canvas"
                  } ${rowHovered ? hoverRing : ""}`}
                  style={{ paddingInline: size.padX, gap: size.gap }}
                >
                  <span className="whitespace-nowrap">{row.label}</span>
                  <span
                    className="text-muted tabular-nums"
                    title={`Imported by ${row.fanIn} ${row.fanIn === 1 ? "file" : "files"}`}
                  >
                    {row.fanIn}
                  </span>
                </button>
                {inView ? <Anchors inId={inId} outId={outId} /> : null}
              </li>
            );
          })}
        </ul>
        {scrolls ? (
          <div
            className={`relative flex items-center font-mono text-[11px] text-muted tabular-nums ${
              anchorLit(handle.belowIn, handle.belowOut) ? "" : "opacity-25"
            }`}
            style={{ height: size.rowHeight, paddingInline: size.padX }}
          >
            {above === 0
              ? `${below} more`
              : below === 0
                ? `${above} above`
                : `${above} above · ${below} below`}
            <Anchors inId={handle.belowIn} outId={handle.belowOut} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Invisible connection points on the left and right edges of whatever element
// they're placed in, which has to be positioned.
function Anchors({ inId, outId }: { inId: string; outId: string }) {
  return (
    <>
      <Handle
        type="target"
        id={inId}
        position={Position.Left}
        isConnectable={false}
        style={hiddenHandle}
      />
      <Handle
        type="source"
        id={outId}
        position={Position.Right}
        isConnectable={false}
        style={hiddenHandle}
      />
    </>
  );
}

