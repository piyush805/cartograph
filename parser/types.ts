// The shape the parser writes. Everything downstream reads this, so changing a
// field here is a contract change, not a refactor. Paths are repository-relative
// and always use forward slashes.

export type ImportKind = "import" | "re-export" | "dynamic";

export interface ParsedFile {
  path: string;
  // Immediate parent directory, "." for files at the root. Everything that
  // groups files groups by this.
  folder: string;
  extension: string;
  lines: number;
  bytes: number;
  sha256: string;
  // Set by a framework adapter. null means no adapter identified the file.
  role: string | null;
  // Distinct files this one imports / distinct files importing this one.
  fanOut: number;
  fanIn: number;
}

// One per resolved import statement, so a file importing another twice yields
// two edges. Fan-in and fan-out are computed after collapsing those.
export interface Edge {
  from: string;
  to: string;
  kind: ImportKind;
  typeOnly: boolean;
  line: number;
}

export type ExcludedCode =
  | "declaration"
  | "non-source"
  | "skipped-target"
  | "excluded-directory"
  | "not-walked";

export type UnresolvedCode =
  | "no-file"
  | "no-index"
  | "case-mismatch"
  | "alias-no-file"
  | "base-url-no-file"
  | "subpath-import"
  | "workspace-package"
  | "undeclared-package"
  | "loader-syntax"
  | "non-literal"
  | "not-resolvable";

export type ImportOutcome =
  | { status: "internal"; to: string }
  | { status: "external"; target: "package"; name: string; installed: boolean }
  | { status: "external"; target: "builtin"; name: string }
  | { status: "external"; target: "outside"; path: string }
  | { status: "excluded"; code: ExcludedCode; path: string; reason: string }
  | { status: "unresolved"; code: UnresolvedCode; reason: string };

export type ImportStatus = ImportOutcome["status"];

export interface ImportRecord {
  from: string;
  line: number;
  kind: ImportKind;
  // null only for a dynamic import whose argument isn't a string literal.
  specifier: string | null;
  typeOnly: boolean;
  outcome: ImportOutcome;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ExcludedDirectory {
  path: string;
  reason: string;
}

export interface ConfigReport {
  path: string;
  errors: string[];
}

export type OutcomeCounts = { seen: number } & Record<ImportStatus, number>;

export interface Coverage {
  // found = parsed + skipped, always.
  files: { found: number; parsed: number; skipped: number };
  skippedFiles: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
  configs: ConfigReport[];
  imports: OutcomeCounts;
  byKind: Record<ImportKind, OutcomeCounts>;
}

export interface ParseResult {
  version: 1;
  adapter: string;
  files: ParsedFile[];
  edges: Edge[];
  imports: ImportRecord[];
  coverage: Coverage;
}
