// Usage: node parser/cli.ts <directory> [--out <file.ts>]
//
// Prints what the parser found. With --out, writes the full result as a
// TypeScript module annotated with ParseResult, so the compiler checks the
// data against the contract whenever it's imported.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRepository } from "./index.ts";
import type { ImportKind, ImportRecord, OutcomeCounts, ParseResult } from "./types.ts";

const EXAMPLES_PER_REASON = 5;

function main(argv: string[]): number {
  const args = [...argv];
  let out: string | null = null;
  const outIndex = args.indexOf("--out");
  if (outIndex !== -1) {
    out = args[outIndex + 1] ?? null;
    if (!out || !out.endsWith(".ts")) {
      console.error("--out needs a path ending in .ts");
      return 2;
    }
    args.splice(outIndex, 2);
  }
  if (args.length !== 1) {
    console.error("usage: node parser/cli.ts <directory> [--out <file.ts>]");
    return 2;
  }

  const started = performance.now();
  const result = parseRepository(args[0]);
  const elapsed = Math.round(performance.now() - started);

  print(result, path.resolve(args[0]), elapsed);

  if (out) {
    write(result, path.resolve(out));
    console.log(`\nwrote ${path.resolve(out)}`);
  }
  return 0;
}

function print(result: ParseResult, root: string, elapsed: number): void {
  const { coverage } = result;
  const line = (label: string, value: string) => console.log(`${label.padEnd(12)}${value}`);

  line("root", root);
  line("adapter", result.adapter);
  line("time", `${elapsed} ms`);
  line(
    "files",
    `${coverage.files.found} found = ${coverage.files.parsed} parsed + ${coverage.files.skipped} skipped`,
  );
  for (const skip of coverage.skippedFiles) console.log(`  skipped   ${skip.path} — ${skip.reason}`);

  const folders = new Set(result.files.map((f) => f.folder));
  line("folders", String(folders.size));
  line("lines", String(result.files.reduce((sum, f) => sum + f.lines, 0)));

  console.log("\nimports     seen  internal  external  excluded  unresolved");
  const row = (label: string, c: OutcomeCounts) =>
    console.log(
      `  ${label.padEnd(10)}${pad(c.seen, 4)}${pad(c.internal, 10)}${pad(c.external, 10)}${pad(c.excluded, 10)}${pad(c.unresolved, 12)}`,
    );
  row("all", coverage.imports);
  for (const kind of ["import", "re-export", "dynamic"] satisfies ImportKind[]) row(kind, coverage.byKind[kind]);

  const pairs = new Set(result.edges.map((e) => `${e.from}\n${e.to}`));
  line("\nedges", `${result.edges.length} (${pairs.size} distinct file pairs)`);

  console.log("\nexcluded directories");
  if (coverage.excludedDirectories.length === 0) console.log("  none");
  for (const dir of coverage.excludedDirectories) console.log(`  ${dir.path} — ${dir.reason}`);

  console.log("\nconfigs");
  if (coverage.configs.length === 0) console.log("  none found; default resolution (bundler)");
  for (const config of coverage.configs) {
    console.log(`  ${config.path}${config.errors.length ? "" : " — ok"}`);
    for (const error of config.errors) console.log(`    error: ${error}`);
  }

  printGrouped(
    "excluded imports",
    result.imports.filter((i) => i.outcome.status === "excluded"),
    (i) => (i.outcome.status === "excluded" ? i.outcome.code : ""),
    (i) => (i.outcome.status === "excluded" ? `${i.outcome.path} — ${i.outcome.reason}` : ""),
  );
  printGrouped(
    "unresolved imports",
    result.imports.filter((i) => i.outcome.status === "unresolved"),
    (i) => (i.outcome.status === "unresolved" ? i.outcome.code : ""),
    (i) => (i.outcome.status === "unresolved" ? i.outcome.reason : ""),
  );

  const packages = new Map<string, number>();
  for (const i of result.imports) {
    if (i.outcome.status === "external" && i.outcome.target === "package" && !i.outcome.installed) {
      packages.set(i.outcome.name, (packages.get(i.outcome.name) ?? 0) + 1);
    }
  }
  if (packages.size > 0) {
    console.log(`\npackages not installed (${packages.size}), counted as external`);
    console.log(`  ${[...packages.keys()].sort().join(", ")}`);
  }
}

function printGrouped(
  title: string,
  records: ImportRecord[],
  code: (r: ImportRecord) => string,
  detail: (r: ImportRecord) => string,
): void {
  console.log(`\n${title} (${records.length})`);
  if (records.length === 0) {
    console.log("  none");
    return;
  }
  const groups = new Map<string, ImportRecord[]>();
  for (const record of records) {
    const key = code(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  for (const [key, group] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${key} (${group.length})`);
    for (const record of group.slice(0, EXAMPLES_PER_REASON)) {
      console.log(`    ${record.from}:${record.line}  ${JSON.stringify(record.specifier)}  ${detail(record)}`);
    }
    if (group.length > EXAMPLES_PER_REASON) console.log(`    … ${group.length - EXAMPLES_PER_REASON} more in the output file`);
  }
}

function write(result: ParseResult, file: string): void {
  const typesPath = fileURLToPath(new URL("./types.ts", import.meta.url));
  let specifier = path.relative(path.dirname(file), typesPath).split(path.sep).join("/");
  if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) specifier = `./${specifier}`;
  const body = [
    "// Generated by parser/cli.ts. Do not edit by hand.",
    `import type { ParseResult } from ${JSON.stringify(specifier)};`,
    "",
    `const result: ParseResult = ${JSON.stringify(result, null, 2)};`,
    "",
    "export default result;",
    "",
  ].join("\n");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width);
}

process.exitCode = main(process.argv.slice(2));
