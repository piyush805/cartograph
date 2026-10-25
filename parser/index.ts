import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { Project, type SourceFile } from "ts-morph";
import { selectAdapter } from "./adapters/index.ts";
import { extractImports } from "./extract.ts";
import { fanCounts } from "./graph.ts";
import { readManifest } from "./manifest.ts";
import { createResolver } from "./resolve.ts";
import type {
  Coverage,
  Edge,
  ImportOutcome,
  ImportRecord,
  OutcomeCounts,
  ParsedFile,
  ParseResult,
  SkippedFile,
} from "./types.ts";
import { walk } from "./walk.ts";

export type * from "./types.ts";

const MAX_BYTES = 1024 * 1024;
// A line this long is a bundle or generated output, not code someone wrote.
const MAX_LINE_LENGTH = 10_000;

// Path in, data out. Reads the directory as it is on disk and touches nothing
// else: no network, no git, no installed tooling beyond the TypeScript parser.
export function parseRepository(directory: string): ParseResult {
  const root = realpathSync.native(path.resolve(directory));
  if (!statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);

  const walked = walk(root);
  const skipped: SkippedFile[] = [...walked.skipped];
  const skippedPaths = new Set(skipped.map((s) => s.path));

  // noResolve/noLib: the program exists only to report syntax errors, so it
  // must not go loading imported files or the standard library.
  const project = new Project({
    compilerOptions: { allowJs: true, noLib: true, noResolve: true, types: [] },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  interface Loaded {
    path: string;
    content: Buffer;
    lines: number;
    source: SourceFile;
  }
  const loaded: Loaded[] = [];

  for (const relative of walked.candidates) {
    if (skippedPaths.has(relative)) continue;
    const content = readFileSync(path.join(root, relative));
    const reason = unparseableReason(content);
    if (reason) {
      skipped.push({ path: relative, reason });
      continue;
    }
    const text = content.toString("utf8");
    const source = project.createSourceFile(path.join(root, relative), text, { overwrite: true });
    loaded.push({ path: relative, content, lines: countLines(text), source });
  }

  const program = project.getProgram();
  const parsedFiles: Loaded[] = [];
  for (const file of loaded) {
    // Codes below 2000 are parse errors. Others (e.g. "type annotations can
    // only be used in TypeScript files") leave a complete syntax tree.
    const syntaxError = program
      .getSyntacticDiagnostics(file.source)
      .find((d) => d.getCode() < 2000);
    if (syntaxError) {
      const message = syntaxError.getMessageText();
      const text = typeof message === "string" ? message : message.getMessageText();
      skipped.push({ path: file.path, reason: `syntax error at line ${syntaxError.getLineNumber()}: ${text}` });
    } else {
      parsedFiles.push(file);
    }
  }

  const parsed = new Set(parsedFiles.map((f) => f.path));
  const resolver = createResolver(root, {
    parsed,
    skipped: new Map(skipped.map((s) => [s.path, s.reason])),
    manifests: walked.manifests,
  });

  const imports: ImportRecord[] = [];
  for (const file of parsedFiles) {
    for (const raw of extractImports(file.source)) {
      const outcome: ImportOutcome =
        raw.specifier === null
          ? {
              status: "unresolved",
              code: "non-literal",
              reason: `dynamic import with a non-literal argument: import(${raw.expression})`,
            }
          : resolver.resolve(file.path, raw.specifier);
      imports.push({
        from: file.path,
        line: raw.line,
        kind: raw.kind,
        specifier: raw.specifier,
        typeOnly: raw.typeOnly,
        outcome,
      });
    }
  }

  const edges: Edge[] = [];
  for (const record of imports) {
    if (record.outcome.status !== "internal") continue;
    edges.push({
      from: record.from,
      to: record.outcome.to,
      kind: record.kind,
      typeOnly: record.typeOnly,
      line: record.line,
    });
  }

  const paths = parsedFiles.map((f) => f.path);
  // A missing or malformed root package.json declares nothing; a malformed
  // one is already listed in coverage.configs by the resolver.
  const rootManifest = walked.manifests.includes("package.json")
    ? readManifest(path.join(root, "package.json"))
    : null;
  const dependencies = rootManifest && "manifest" in rootManifest ? rootManifest.manifest.dependencies : [];
  const adapter = selectAdapter({ files: paths, dependencies });
  const fans = fanCounts(paths, edges);

  const files: ParsedFile[] = parsedFiles.map((file) => {
    const fan = fans.get(file.path) ?? { fanIn: 0, fanOut: 0 };
    return {
      path: file.path,
      folder: path.posix.dirname(file.path),
      extension: path.extname(file.path),
      lines: file.lines,
      bytes: file.content.length,
      sha256: createHash("sha256").update(file.content).digest("hex"),
      role: adapter.roleOf(file.path),
      fanOut: fan.fanOut,
      fanIn: fan.fanIn,
    };
  });

  skipped.sort((a, b) => (a.path < b.path ? -1 : 1));
  const coverage: Coverage = {
    files: { found: walked.candidates.length, parsed: files.length, skipped: skipped.length },
    skippedFiles: skipped,
    excludedDirectories: walked.excludedDirectories,
    configs: resolver.configs(),
    imports: countOutcomes(imports),
    byKind: {
      import: countOutcomes(imports.filter((i) => i.kind === "import")),
      "re-export": countOutcomes(imports.filter((i) => i.kind === "re-export")),
      dynamic: countOutcomes(imports.filter((i) => i.kind === "dynamic")),
    },
  };

  if (coverage.files.found !== coverage.files.parsed + coverage.files.skipped) {
    throw new Error(
      `File accounting is broken: ${coverage.files.found} found, ${coverage.files.parsed} parsed, ${coverage.files.skipped} skipped`,
    );
  }

  return { version: 1, adapter: adapter.name, files, edges, imports, coverage };
}

function unparseableReason(content: Buffer): string | null {
  if (content.length > MAX_BYTES) return `larger than 1 MB (${content.length} bytes)`;
  if (content.includes(0)) return "binary content";
  let longest = 0;
  let current = 0;
  for (const byte of content) {
    if (byte === 0x0a) {
      longest = Math.max(longest, current);
      current = 0;
    } else {
      current += 1;
    }
  }
  longest = Math.max(longest, current);
  if (longest > MAX_LINE_LENGTH) return `minified or generated (a line is ${longest} bytes long)`;
  return null;
}

function countLines(text: string): number {
  if (text === "") return 0;
  const breaks = text.match(/\r\n|\r|\n/g)?.length ?? 0;
  return /(\r\n|\r|\n)$/.test(text) ? breaks : breaks + 1;
}

function countOutcomes(records: readonly ImportRecord[]): OutcomeCounts {
  const counts: OutcomeCounts = { seen: records.length, internal: 0, external: 0, excluded: 0, unresolved: 0 };
  for (const record of records) counts[record.outcome.status] += 1;
  return counts;
}
