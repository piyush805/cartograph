// The shortest trailing run of path segments that no other path on screen ends
// with. A path shorter than the run compares as a whole, so "a/b/c" next to
// "b/c" labels as "a/b/c" and "b/c".
export function shortestUnique(paths: readonly string[]): Map<string, string> {
  const split = paths.map((p) => p.split("/"));
  const suffix = (segments: string[], k: number) =>
    segments.slice(Math.max(0, segments.length - k)).join("/");

  const labels = new Map<string, string>();
  split.forEach((segments, index) => {
    for (let k = 1; k <= segments.length; k++) {
      const candidate = suffix(segments, k);
      const clash = split.some(
        (other, j) => j !== index && suffix(other, k) === candidate,
      );
      if (!clash || k === segments.length) {
        labels.set(paths[index], candidate);
        return;
      }
    }
  });
  return labels;
}
