"use client";

import { useMemo, useState } from "react";
import {
  folderContents,
  neighboursOf,
  type DetailFile,
  type Neighbours,
  type RankedFile,
  type RepositorySummary,
} from "@/lib/detail";
import { colourOf } from "@/lib/map/categories";
import type { Group } from "@/lib/map/fold";
import type { FileLink } from "@/lib/map/graph";
import { filesLabel, ROOT_LABEL } from "@/lib/map/graph";
import type { Selection } from "@/lib/map/highlight";

type Tab = "structure" | "explanation";

interface PathActions {
  hover: Selection | null;
  // The folder each file is drawn in on the map.
  groupOf: ReadonlyMap<string, string>;
  onSelectPath: (path: string) => void;
  onHover: (hover: Selection | null) => void;
}

export function DetailPane({
  repository,
  summary,
  selection,
  filesByPath,
  groups,
  links,
  neighbours,
  ...actions
}: PathActions & {
  repository: string;
  summary: RepositorySummary;
  selection: Selection | null;
  filesByPath: ReadonlyMap<string, DetailFile>;
  groups: ReadonlyMap<string, Group>;
  links: readonly FileLink[];
  neighbours: ReadonlyMap<string, Neighbours>;
}) {
  // Lives above the selection, so comparing explanations across files keeps
  // the same tab open.
  const [tab, setTab] = useState<Tab>("structure");
  // With only the fallback, no convention was ever consulted, which is a
  // different fact from an adapter looking and finding nothing.
  const unidentified =
    summary.framework === null ? "no adapter applied" : "none identified";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 border-b border-line px-1">
        <TabButton tab="structure" current={tab} onSelect={setTab}>
          Structure
        </TabButton>
        <TabButton tab="explanation" current={tab} onSelect={setTab}>
          Explanation
        </TabButton>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tab === "explanation" ? (
          <p className="px-3 py-3 text-[12px] text-muted">
            No explanation yet. Explanations come from a model call, and none
            is connected.
          </p>
        ) : selection === null ? (
          <RepositoryStructure
            repository={repository}
            summary={summary}
            actions={actions}
          />
        ) : selection.kind === "file" ? (
          <FileStructure
            file={filesByPath.get(selection.path)}
            path={selection.path}
            neighbours={neighboursOf(neighbours, selection.path)}
            unidentified={unidentified}
            actions={actions}
          />
        ) : (
          <FolderStructure
            unidentified={unidentified}
            dir={selection.dir}
            group={groups.get(selection.dir)}
            filesByPath={filesByPath}
            links={links}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  current,
  onSelect,
  children,
}: {
  tab: Tab;
  current: Tab;
  onSelect: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  const active = tab === current;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab)}
      className={`-mb-px border-b px-2 py-1 text-[12px] ${
        active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function RepositoryStructure({
  repository,
  summary,
  actions,
}: {
  repository: string;
  summary: RepositorySummary;
  actions: PathActions;
}) {
  const { files, imports, unimported } = summary;
  return (
    <>
      <Section>
        <p className="break-all font-mono text-[12px] font-medium">
          {repository}
        </p>
        <Facts>
          <Fact name="framework">
            {summary.framework ?? (
              <span className="text-muted">none detected</span>
            )}
          </Fact>
          <Fact name="files">
            {files.parsed}
            {files.skipped > 0 ? (
              <span className="text-muted"> · {files.skipped} skipped</span>
            ) : null}
          </Fact>
          <Fact name="imports">
            {imports.seen}
            <span className="text-muted"> · {imports.internal} to repo files</span>
          </Fact>
          <Fact name="routes">
            —
            <span className="text-muted">
              {" "}
              {summary.framework === null
                ? "no framework adapter"
                : "not identified by this adapter"}
            </span>
          </Fact>
          <Fact name="unidentified">
            {summary.unidentified === files.parsed ? "all " : ""}
            {summary.unidentified}
            <span className="text-muted">
              {" "}
              {filesWord(summary.unidentified)}
              {summary.framework === null ? " · no adapter applied" : ""}
            </span>
          </Fact>
        </Facts>
      </Section>
      <Section
        heading="Most depended on"
        note="by files importing it"
      >
        <RankedList
          files={summary.mostImported}
          countTitle={(count) => `Imported by ${count} ${filesWord(count)}`}
          actions={actions}
        />
      </Section>
      <Section
        heading="Imported by nothing"
        note={`${unimported.top.length} of ${unimported.total} · by files it imports`}
      >
        <p className="px-3 pb-1 text-[11px] text-muted">
          Where reading starts.
        </p>
        <RankedList
          files={unimported.top}
          countTitle={(count) => `Imports ${count} ${filesWord(count)}`}
          actions={actions}
        />
      </Section>
    </>
  );
}

function FileStructure({
  file,
  path,
  neighbours,
  unidentified,
  actions,
}: {
  file: DetailFile | undefined;
  path: string;
  neighbours: Neighbours;
  unidentified: string;
  actions: PathActions;
}) {
  const { imports, importedBy } = neighbours;
  const colour = file ? colourOf(file.extension) : null;
  return (
    <>
      <Section>
        <p className="break-all font-mono text-[12px] font-medium">{path}</p>
        {file ? (
          <Facts>
            <Fact name="kind">
              <span className="inline-flex items-center gap-1.5">
                {colour ? (
                  <span
                    aria-hidden
                    className="size-2"
                    style={{ background: colour }}
                  />
                ) : null}
                {file.extension}
              </span>
            </Fact>
            <Fact name="convention">
              {file.role ?? <span className="text-muted">{unidentified}</span>}
            </Fact>
            <Fact name="lines">{file.lines}</Fact>
            <Fact name="imports">{imports.length}</Fact>
            <Fact name="imported by">{importedBy.length}</Fact>
          </Facts>
        ) : null}
      </Section>
      <Section heading="Imports" note={String(imports.length)}>
        <PathList paths={imports} actions={actions} empty="Imports no repository files." />
      </Section>
      <Section heading="Imported by" note={String(importedBy.length)}>
        <PathList
          paths={importedBy}
          actions={actions}
          empty="No repository file imports this."
        />
      </Section>
    </>
  );
}

function FolderStructure({
  unidentified,
  dir,
  group,
  filesByPath,
  links,
}: {
  unidentified: string;
  dir: string;
  group: Group | undefined;
  filesByPath: ReadonlyMap<string, DetailFile>;
  links: readonly FileLink[];
}) {
  const contents = useMemo(
    () =>
      folderContents(
        (group?.files ?? []).flatMap((path) => {
          const file = filesByPath.get(path);
          return file ? [file] : [];
        }),
        links,
      ),
    [group, filesByPath, links],
  );
  return (
    <>
      <Section>
        <p className="break-all font-mono text-[12px] font-medium">
          {dir === "." ? ROOT_LABEL : `${dir}/`}
        </p>
        <Facts>
          <Fact name="files">{contents.files}</Fact>
          <Fact name="imported by">
            {contents.fanIn}
            <span className="text-muted"> outside</span>
          </Fact>
          <Fact name="imports">
            {contents.fanOut}
            <span className="text-muted"> outside</span>
          </Fact>
        </Facts>
      </Section>
      <Section heading="Kinds of file" note={filesLabel(contents.files)}>
        <ul>
          {contents.extensions.map(({ extension, files }) => {
            const colour = colourOf(extension);
            return (
              <CountRow key={extension} count={files}>
                <span
                  aria-hidden
                  className="size-2 shrink-0"
                  style={colour ? { background: colour } : undefined}
                />
                <span className="font-mono">{extension}</span>
              </CountRow>
            );
          })}
        </ul>
      </Section>
      <Section heading="Conventions">
        <ul>
          {contents.roles.map(({ role, files }) => (
            <CountRow key={role ?? ""} count={files}>
              {role ?? <span className="text-muted">{unidentified}</span>}
            </CountRow>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Section({
  heading,
  note,
  children,
}: {
  heading?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-2 last:border-b-0">
      {heading ? (
        <h3 className="flex items-baseline gap-2 px-3 pb-1 text-[11px] font-medium text-muted">
          {heading}
          {note ? (
            <span className="font-normal tabular-nums">{note}</span>
          ) : null}
        </h3>
      ) : null}
      {heading ? children : <div className="px-3">{children}</div>}
    </section>
  );
}

function Facts({ children }: { children: React.ReactNode }) {
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[12px] leading-5">
      {children}
    </dl>
  );
}

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{name}</dt>
      <dd className="font-mono tabular-nums">{children}</dd>
    </>
  );
}

function CountRow({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex h-5 items-center gap-2 px-3 text-[12px]">
      {children}
      <span className="ml-auto font-mono text-muted tabular-nums">{count}</span>
    </li>
  );
}

function RankedList({
  files,
  countTitle,
  actions,
}: {
  files: readonly RankedFile[];
  countTitle: (count: number) => string;
  actions: PathActions;
}) {
  if (files.length === 0) {
    return <p className="px-3 text-[12px] text-muted">None.</p>;
  }
  return (
    <ul>
      {files.map(({ path, count }) => (
        <li key={path}>
          <PathButton path={path} actions={actions}>
            <span className="text-muted tabular-nums" title={countTitle(count)}>
              {count}
            </span>
          </PathButton>
        </li>
      ))}
    </ul>
  );
}

function PathList({
  paths,
  actions,
  empty,
}: {
  paths: readonly string[];
  actions: PathActions;
  empty: string;
}) {
  if (paths.length === 0) {
    return <p className="px-3 text-[12px] text-muted">{empty}</p>;
  }
  return (
    <ul>
      {paths.map((path) => (
        <li key={path}>
          <PathButton path={path} actions={actions} />
        </li>
      ))}
    </ul>
  );
}

function PathButton({
  path,
  actions: { hover, groupOf, onSelectPath, onHover },
  children,
}: {
  path: string;
  actions: PathActions;
  children?: React.ReactNode;
}) {
  const dir = groupOf.get(path);
  // A hovered folder on the map lights every file drawn inside it.
  const lit =
    hover !== null &&
    (hover.kind === "file" ? hover.path === path : hover.dir === dir);
  return (
    <button
      type="button"
      title={path}
      onClick={() => {
        onHover(null);
        onSelectPath(path);
      }}
      onMouseEnter={() =>
        dir !== undefined && onHover({ kind: "file", dir, path })
      }
      onMouseLeave={() => onHover(null)}
      className={`flex h-5 w-full items-center gap-2 px-3 text-left font-mono text-[11px] ${
        lit ? "bg-accent/15 ring-1 ring-inset ring-accent" : "hover:bg-canvas"
      }`}
    >
      {/* Right-to-left truncation keeps the file name and drops the start of
          the path when it doesn't fit. */}
      <span dir="rtl" className="min-w-0 flex-1 truncate text-left">
        <bdi>{path}</bdi>
      </span>
      {children}
    </button>
  );
}

function filesWord(count: number): string {
  return count === 1 ? "file" : "files";
}
