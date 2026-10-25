// Folding decides which directories become nodes. Nothing about the repository
// is assumed: every directory starts as a node, small ones merge upward, and the
// threshold for "small" rises only until the map is readable.

export const MAX_NODES = 24;
const FIRST_THRESHOLD = 2;

export interface Group {
  dir: string;
  files: string[];
}

export interface Folding {
  threshold: number;
  groups: Group[];
}

export function parentDir(dir: string): string {
  const slash = dir.lastIndexOf("/");
  return slash === -1 ? "." : dir.slice(0, slash);
}

function depth(dir: string): number {
  return dir === "." ? 0 : dir.split("/").length;
}

// Every pass reads all counts at one depth before moving anything, so a merge
// never changes what a sibling merge at the same depth sees. Merges only ever
// add to the depth above, which is read on the next pass.
export function foldAt(
  files: readonly { path: string; folder: string }[],
  threshold: number,
): Group[] {
  const holding = new Map<string, string[]>();
  for (const file of files) {
    let dir = file.folder;
    const own = holding.get(dir);
    if (own) own.push(file.path);
    else holding.set(dir, [file.path]);
    while (dir !== ".") {
      dir = parentDir(dir);
      if (!holding.has(dir)) holding.set(dir, []);
    }
  }

  const deepest = Math.max(0, ...[...holding.keys()].map(depth));
  for (let level = deepest; level > 0; level--) {
    const merging = [...holding]
      .filter(([dir, held]) => depth(dir) === level && held.length < threshold)
      .map(([dir]) => dir);
    for (const dir of merging) {
      holding.get(parentDir(dir))!.push(...holding.get(dir)!);
      holding.delete(dir);
    }
  }

  return [...holding]
    .filter(([, held]) => held.length > 0)
    .map(([dir, held]) => ({ dir, files: [...held].sort() }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}

export function fold(
  files: readonly { path: string; folder: string }[],
): Folding {
  // Terminates: once the threshold exceeds the file count everything has
  // merged into the root, which is one node.
  for (let threshold = FIRST_THRESHOLD; ; threshold++) {
    const groups = foldAt(files, threshold);
    if (groups.length <= MAX_NODES) return { threshold, groups };
  }
}
