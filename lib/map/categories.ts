// Files grouped by extension until adapters assign real roles. Order and
// colour are fixed per extension, so a category sits in the same place with the
// same swatch in every repository. Red, green and amber are left out because
// they already mean failure, fan-in and fan-out.

export interface Category {
  name: string;
  colour: string;
  files: number;
}

const taxonomy: readonly { name: string; colour: string }[] = [
  { name: ".ts", colour: "#3b82f6" },
  { name: ".tsx", colour: "#8b5cf6" },
  { name: ".mts", colour: "#06b6d4" },
  { name: ".cts", colour: "#0d9488" },
  { name: ".js", colour: "#db2777" },
  { name: ".jsx", colour: "#c026d3" },
  { name: ".mjs", colour: "#64748b" },
  { name: ".cjs", colour: "#a8a29e" },
];

export function colourOf(extension: string): string | null {
  return taxonomy.find(({ name }) => name === extension)?.colour ?? null;
}

export function categorize(
  files: readonly { extension: string }[],
): Category[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    counts.set(file.extension, (counts.get(file.extension) ?? 0) + 1);
  }
  return taxonomy
    .filter(({ name }) => counts.has(name))
    .map(({ name, colour }) => ({ name, colour, files: counts.get(name)! }));
}
