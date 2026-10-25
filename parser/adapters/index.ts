import { fallbackAdapter } from "./fallback.ts";
import type { FrameworkAdapter, RepositoryFacts } from "./types.ts";

// Checked in order; the fallback is last and always matches.
const adapters: readonly FrameworkAdapter[] = [fallbackAdapter];

export function selectAdapter(facts: RepositoryFacts): FrameworkAdapter {
  return adapters.find((adapter) => adapter.detect(facts)) ?? fallbackAdapter;
}
