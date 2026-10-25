// Framework knowledge lives behind this interface and nowhere else. The parser
// hands an adapter facts about the repository and asks questions; it never
// checks for a framework itself.

export interface RepositoryFacts {
  // Repository-relative paths of every parsed file.
  files: readonly string[];
  // Names from the root package.json dependencies and devDependencies.
  dependencies: readonly string[];
}

export interface FrameworkAdapter {
  name: string;
  detect(facts: RepositoryFacts): boolean;
  // The file's role under this framework's conventions, or null when the
  // convention says nothing about it.
  roleOf(file: string): string | null;
}
