import type { FrameworkAdapter } from "./types.ts";

// Assumes no framework. Matches every repository and identifies no file,
// rather than inferring roles from names it has no convention for.
export const fallbackAdapter: FrameworkAdapter = {
  name: "none",
  detect: () => true,
  roleOf: () => null,
};
