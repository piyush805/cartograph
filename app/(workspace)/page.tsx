import { auth } from "@clerk/nextjs/server";
import {
  LIST_LIMIT,
  listAnalyses,
  type AnalysisSummary,
} from "@/lib/analyses";

export const instant = false;

// Shape carries the state as well as colour, so the column reads without
// relying on hue. Red is reserved for failure; nothing else on the page uses it.
const states: Record<string, { marker: string; label: string }> = {
  queued: { marker: "border-muted", label: "text-muted" },
  parsing: {
    marker:
      "border-accent bg-[linear-gradient(to_right,var(--accent)_50%,transparent_50%)]",
    label: "text-accent",
  },
  complete: { marker: "border-ink bg-ink", label: "text-ink" },
  failed: { marker: "border-failed bg-failed", label: "text-failed" },
};

export default async function WorkspacePage() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return (
      <Notice title="No organization selected">
        Pick or create an organization from the switcher in the top bar.
      </Notice>
    );
  }

  const analyses = await listAnalyses();

  if (analyses.length === 0) {
    return (
      <Notice title="No analyses yet">
        This organization hasn&apos;t analysed a repository yet.
      </Notice>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h1 className="text-[13px] font-medium">Analyses</h1>
        <span className="font-mono text-[12px] tabular-nums text-muted">
          {analyses.length}
        </span>
        {analyses.length === LIST_LIMIT ? (
          <span className="ml-auto text-[12px] text-muted">
            Showing the {LIST_LIMIT} most recent
          </span>
        ) : null}
      </header>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="bg-canvas text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-normal">Repository</th>
              <th className="px-3 py-1.5 font-normal">State</th>
              <th className="px-3 py-1.5 font-normal">Commit</th>
              <th className="px-3 py-1.5 font-normal">Started (UTC)</th>
              <th className="px-3 py-1.5 text-right font-normal">Took</th>
            </tr>
          </thead>
          {analyses.map((analysis) => (
            <AnalysisRows key={analysis.id} analysis={analysis} />
          ))}
        </table>
      </div>
    </section>
  );
}

// One tbody per analysis so the hover tint covers the error line with its row.
function AnalysisRows({ analysis }: { analysis: AnalysisSummary }) {
  return (
    <tbody className="border-b border-line last:border-b-0 hover:bg-canvas">
      <tr>
        <td className="whitespace-nowrap px-3 py-1.5 font-mono">
          <span className="text-muted">{analysis.repoOwner}/</span>
          {analysis.repoName}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5">
          <State status={analysis.status} />
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-muted">
          {analysis.commitSha ?? "—"}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-muted">
          {formatTimestamp(analysis.createdAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-muted">
          {analysis.finishedAt
            ? formatDuration(analysis.createdAt, analysis.finishedAt)
            : "—"}
        </td>
      </tr>
      {analysis.error ? (
        <tr>
          <td
            colSpan={5}
            className="px-3 pb-1.5 font-mono text-[11px] text-failed"
          >
            {analysis.error}
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

function State({ status }: { status: string }) {
  const style = states[status];

  if (!style) return <span>{status}</span>;

  return (
    <span className={`inline-flex items-center gap-1.5 ${style.label}`}>
      <span aria-hidden className={`size-2 border ${style.marker}`} />
      {status}
    </span>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl border border-line bg-surface px-3 py-3">
      <h1 className="text-[13px] font-medium">{title}</h1>
      <p className="mt-0.5 text-[12px] text-muted">{children}</p>
    </section>
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function formatDuration(startIso: string, endIso: string): string {
  const seconds = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000,
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
