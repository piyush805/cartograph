// What the detail pane says, derived from the parse result already in the
// browser. Pure, so selecting something never needs a request.

import { fallbackAdapter } from "../parser/adapters/fallback.ts";
import type { Coverage, ParsedFile } from "../parser/types.ts";
import type { FileLink } from "./map/graph.ts";

export type DetailFile = Pick<
  ParsedFile,
  "path" | "folder" | "extension" | "lines" | "role" | "fanIn" | "fanOut"
>;

export interface RankedFile {
  path: string;
  count: number;
}

export interface RepositorySummary {
  // null when only the fallback matched, which identifies no framework.
  framework: string | null;
  files: { parsed: number; skipped: number };
  imports: { seen: number; internal: number };
  // Ranked by how many files import each one.
  mostImported: RankedFile[];
  // Files with no importers, ranked by how much each pulls in: the ones that
  // reach furthest into the repository are where reading starts.
  unimported: { total: number; top: RankedFile[] };
  unidentified: number;
}

const RANKED = 10;

export function summarize(
  adapter: string,
  files: readonly DetailFile[],
  coverage: Coverage,
): RepositorySummary {
  const byPath = (a: RankedFile, b: RankedFile) =>
    b.count - a.count || compare(a.path, b.path);
  const unimported = files
    .filter((file) => file.fanIn === 0)
    .map((file) => ({ path: file.path, count: file.fanOut }))
    .sort(byPath);

  return {
    framework: adapter === fallbackAdapter.name ? null : adapter,
    files: { parsed: coverage.files.parsed, skipped: coverage.files.skipped },
    imports: { seen: coverage.imports.seen, internal: coverage.imports.internal },
    mostImported: files
      .filter((file) => file.fanIn > 0)
      .map((file) => ({ path: file.path, count: file.fanIn }))
      .sort(byPath)
      .slice(0, RANKED),
    unimported: { total: unimported.length, top: unimported.slice(0, RANKED) },
    unidentified: files.filter((file) => file.role === null).length,
  };
}

export interface Neighbours {
  imports: string[];
  importedBy: string[];
}

const none: Neighbours = { imports: [], importedBy: [] };

// Built from distinct links, so each list's length is the file's fan-out or
// fan-in and the count shown above a list is always its row count.
export function neighbourIndex(
  links: readonly FileLink[],
): ReadonlyMap<string, Neighbours> {
  const index = new Map<string, Neighbours>();
  const entry = (path: string) => {
    let found = index.get(path);
    if (!found) {
      found = { imports: [], importedBy: [] };
      index.set(path, found);
    }
    return found;
  };
  for (const { from, to } of links) {
    entry(from).imports.push(to);
    entry(to).importedBy.push(from);
  }
  for (const found of index.values()) {
    found.imports.sort(compare);
    found.importedBy.sort(compare);
  }
  return index;
}

export function neighboursOf(
  index: ReadonlyMap<string, Neighbours>,
  path: string,
): Neighbours {
  return index.get(path) ?? none;
}

export interface FolderContents {
  files: number;
  extensions: { extension: string; files: number }[];
  // null is files no convention identified.
  roles: { role: string | null; files: number }[];
  // Distinct files outside the folder importing into it / imported by it, the
  // same numbers its panel header shows.
  fanIn: number;
  fanOut: number;
}

export function folderContents(
  files: readonly DetailFile[],
  links: readonly FileLink[],
): FolderContents {
  const inside = new Set(files.map((file) => file.path));
  const importers = new Set<string>();
  const imported = new Set<string>();
  for (const { from, to } of links) {
    if (inside.has(from) && !inside.has(to)) imported.add(to);
    if (inside.has(to) && !inside.has(from)) importers.add(from);
  }
  return {
    files: files.length,
    extensions: tally(files.map((file) => file.extension)).map(
      ([extension, count]) => ({ extension, files: count }),
    ),
    roles: tally(files.map((file) => file.role)).map(([role, count]) => ({
      role,
      files: count,
    })),
    fanIn: importers.size,
    fanOut: imported.size,
  };
}

// Most common first, ties by name, with null last.
function tally<T extends string | null>(values: readonly T[]): [T, number][] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(
    ([a, countA], [b, countB]) =>
      (a === null ? 1 : 0) - (b === null ? 1 : 0) ||
      countB - countA ||
      compare(a ?? "", b ?? ""),
  );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
