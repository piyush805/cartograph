import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ExcludedDirectory, SkippedFile } from "./types.ts";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

// Covers foo.d.ts, foo.d.mts and generated foo.d.css.ts alike.
const DECLARATION = /\.d\.([^./]+\.)?[mc]?ts$/;

export function isSourceFile(name: string): boolean {
  return SOURCE_EXTENSIONS.includes(path.extname(name));
}

export function isDeclarationFile(name: string): boolean {
  return DECLARATION.test(name);
}

export function toRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

export function isInside(relative: string): boolean {
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// Why a directory is never walked. Both rules are structural: installed
// dependencies aren't the repository's code, and dot-directories hold tool
// state (.git, editor config, build caches), not source.
export function excludedDirectoryReason(name: string): string | null {
  if (name === "node_modules") return "installed dependencies";
  if (name.startsWith(".")) return "hidden directory";
  return null;
}

export interface WalkResult {
  // Every source-extension file found, repository-relative, sorted.
  candidates: string[];
  // Found but never handed to the parser.
  skipped: SkippedFile[];
  excludedDirectories: ExcludedDirectory[];
  // Every package.json, repository-relative, sorted.
  manifests: string[];
}

// Whole directories are kept: every source file under the root becomes a
// candidate. Selecting by size or by count would keep an importer and drop the
// file it imports, leaving edges with nothing at the other end.
export function walk(root: string): WalkResult {
  const result: WalkResult = { candidates: [], skipped: [], excludedDirectories: [], manifests: [] };

  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = toRelative(root, absolute);

      if (entry.isSymbolicLink()) {
        if (isSourceFile(entry.name)) {
          result.candidates.push(relative);
          result.skipped.push({ path: relative, reason: "symbolic link, not followed" });
        } else if (pointsAtDirectory(absolute)) {
          result.excludedDirectories.push({ path: relative, reason: "symbolic link, not followed" });
        }
        continue;
      }

      if (entry.isDirectory()) {
        const reason = excludedDirectoryReason(entry.name);
        if (reason) result.excludedDirectories.push({ path: relative, reason });
        else visit(absolute);
        continue;
      }

      if (entry.isFile() && entry.name === "package.json") result.manifests.push(relative);

      if (entry.isFile() && isSourceFile(entry.name)) {
        result.candidates.push(relative);
        if (isDeclarationFile(entry.name)) {
          result.skipped.push({ path: relative, reason: "type declaration file" });
        }
      }
    }
  };

  visit(root);
  return result;
}

function pointsAtDirectory(absolute: string): boolean {
  try {
    return statSync(absolute).isDirectory();
  } catch {
    return false;
  }
}
