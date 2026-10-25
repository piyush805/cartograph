import { readFileSync } from "node:fs";

export interface Manifest {
  name: string | null;
  // Every name under dependencies, devDependencies, peerDependencies and
  // optionalDependencies.
  dependencies: string[];
}

export function readManifest(absolute: string): { manifest: Manifest } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (typeof data !== "object" || data === null) return { error: "not a JSON object" };

  const blocks: unknown[] = [];
  if ("dependencies" in data) blocks.push(data.dependencies);
  if ("devDependencies" in data) blocks.push(data.devDependencies);
  if ("peerDependencies" in data) blocks.push(data.peerDependencies);
  if ("optionalDependencies" in data) blocks.push(data.optionalDependencies);
  const names = new Set<string>();
  for (const block of blocks) {
    if (typeof block === "object" && block !== null) for (const name of Object.keys(block)) names.add(name);
  }

  const name = "name" in data && typeof data.name === "string" ? data.name : null;
  return { manifest: { name, dependencies: [...names].sort() } };
}
