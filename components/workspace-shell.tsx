// The three columns every analysis view sits in. Later phases fill the slots;
// they don't add, move or overlay columns. The detail pane is a real column so
// selecting something never covers the map.
export function WorkspaceShell({
  rail,
  map,
  detail,
}: {
  rail?: React.ReactNode;
  map?: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_320px]">
      <aside
        aria-label="Categories"
        className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface"
      >
        <ColumnHeading>Categories</ColumnHeading>
        {rail}
      </aside>
      <section aria-label="Map" className="relative min-h-0 bg-canvas">
        {map}
      </section>
      <aside
        aria-label="Detail"
        className="flex min-h-0 flex-col overflow-y-auto border-l border-line bg-surface"
      >
        <ColumnHeading>Detail</ColumnHeading>
        {detail}
      </aside>
    </div>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="shrink-0 border-b border-line px-3 py-1.5 text-[11px] font-medium text-muted">
      {children}
    </h2>
  );
}
