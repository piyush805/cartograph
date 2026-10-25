import type { Metadata } from "next";
import { AnalysisView } from "@/components/analysis-view";
import parsed from "@/fixtures/excalidraw";
import { summarize } from "@/lib/detail";
import { categorize } from "@/lib/map/categories";
import { distinctLinks } from "@/lib/map/graph";

export const metadata: Metadata = {
  title: "Preview · Cartograph",
};

// Generated with `node parser/cli.ts <clone> --out fixtures/excalidraw.ts`
// against a shallow clone of the repository at this commit.
const REPOSITORY = "excalidraw/excalidraw";
const COMMIT = "e1b7aac";

// Lives outside the workspace layout so it needs no account, database or
// network, and is public in the proxy for the same reason. Only what the map
// and detail pane read crosses to the client; the full result stays on the
// server.
export default function PreviewPage() {
  const files = parsed.files.map(
    ({ path, folder, extension, lines, role, fanIn, fanOut }) => ({
      path,
      folder,
      extension,
      lines,
      role,
      fanIn,
      fanOut,
    }),
  );
  const links = distinctLinks(parsed.edges);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-8 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <span className="text-[13px] font-semibold tracking-tight">
          Cartograph
        </span>
        <span aria-hidden className="h-4 w-px bg-line" />
        <span className="text-[12px] text-muted">Preview</span>
        <span className="font-mono text-[12px]">
          {REPOSITORY}
          <span className="text-muted">@{COMMIT}</span>
        </span>
      </header>
      <AnalysisView
        repository={REPOSITORY}
        files={files}
        links={links}
        categories={categorize(parsed.files)}
        summary={summarize(parsed.adapter, files, parsed.coverage)}
      />
    </div>
  );
}
