export interface FanCounts {
  fanIn: number;
  fanOut: number;
}

// Pure: counts distinct neighbours, so importing a file twice (or importing and
// re-exporting it) counts once.
export function fanCounts(
  files: readonly string[],
  edges: readonly { from: string; to: string }[],
): Map<string, FanCounts> {
  const counts = new Map<string, FanCounts>(files.map((f) => [f, { fanIn: 0, fanOut: 0 }]));
  const seen = new Set<string>();
  for (const { from, to } of edges) {
    const key = `${from}\n${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const source = counts.get(from);
    const target = counts.get(to);
    if (source) source.fanOut += 1;
    if (target) target.fanIn += 1;
  }
  return counts;
}
