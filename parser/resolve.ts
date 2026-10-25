import { existsSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { ts } from "ts-morph";
import { readManifest } from "./manifest.ts";
import type { ConfigReport, ImportOutcome } from "./types.ts";
import {
  excludedDirectoryReason,
  isDeclarationFile,
  isInside,
  isSourceFile,
  toRelative,
} from "./walk.ts";

// Resolution is TypeScript's own: the nearest tsconfig.json or jsconfig.json
// supplies paths, baseUrl and module resolution, and ts.resolveModuleName does
// the lookup. Code here only classifies the answer and, when there isn't one,
// works out why.

interface Config {
  options: ts.CompilerOptions;
  cache: ts.ModuleResolutionCache;
}

export interface TargetIndex {
  // Repository-relative paths of files that became nodes.
  parsed: ReadonlySet<string>;
  // Found but skipped, with the reason.
  skipped: ReadonlyMap<string, string>;
  // Repository-relative paths of every package.json.
  manifests: readonly string[];
}

export interface Resolver {
  resolve(fromRelative: string, specifier: string): ImportOutcome;
  configs(): ConfigReport[];
}

const IMPLEMENTATION_FOR_DECLARATION: Record<string, string[]> = {
  ".d.ts": [".js", ".jsx"],
  ".d.mts": [".mjs"],
  ".d.cts": [".cjs"],
};

export function createResolver(root: string, targets: TargetIndex): Resolver {
  const configByDir = new Map<string, Config>();
  const configByPath = new Map<string, Config>();
  const reports: ConfigReport[] = [];
  const parsedByLowerCase = new Map<string, string>();
  for (const file of targets.parsed) parsedByLowerCase.set(file.toLowerCase(), file);

  const defaultConfig: Config = makeConfig({});

  // Which package names each directory with a package.json declares, and
  // which packages the repository itself defines.
  const declaredByDir = new Map<string, Set<string>>();
  // Package name to the manifest path(s) declaring it, comma-separated.
  const workspacePackages = new Map<string, string>();
  for (const manifestPath of targets.manifests) {
    const read = readManifest(path.join(root, manifestPath));
    if ("error" in read) {
      reports.push({ path: manifestPath, errors: [read.error] });
      continue;
    }
    declaredByDir.set(path.posix.dirname(manifestPath), new Set(read.manifest.dependencies));
    if (read.manifest.name) {
      const existing = workspacePackages.get(read.manifest.name);
      workspacePackages.set(read.manifest.name, existing ? `${existing}, ${manifestPath}` : manifestPath);
    }
  }

  function isDeclared(fromRelative: string, name: string): boolean {
    let dir = path.posix.dirname(fromRelative);
    for (;;) {
      if (declaredByDir.get(dir)?.has(name)) return true;
      if (dir === ".") return false;
      dir = path.posix.dirname(dir);
    }
  }

  function makeConfig(options: ts.CompilerOptions): Config {
    const resolved: ts.CompilerOptions = {
      ...options,
      // Widen what counts as a resolvable file without changing where lookup
      // happens. A TS project that doesn't set allowJs still really imports
      // its .js files, and a JSON import is a real import of a real file.
      allowJs: true,
      resolveJsonModule: true,
    };
    // An unset moduleResolution falls back to Classic for ES module targets,
    // which no bundler or runtime uses. Bundler is what such code runs under.
    if (resolved.moduleResolution === undefined) {
      const nodeStyle =
        resolved.module === ts.ModuleKind.Node16 ||
        resolved.module === ts.ModuleKind.NodeNext ||
        resolved.module === ts.ModuleKind.CommonJS;
      resolved.moduleResolution = nodeStyle
        ? resolved.module === ts.ModuleKind.CommonJS
          ? ts.ModuleResolutionKind.Node10
          : ts.ModuleResolutionKind.NodeNext
        : ts.ModuleResolutionKind.Bundler;
      if (!nodeStyle) resolved.module = ts.ModuleKind.ESNext;
    }
    return {
      options: resolved,
      cache: ts.createModuleResolutionCache(root, (name) => name.toLowerCase(), resolved),
    };
  }

  function loadConfig(configPath: string): Config {
    const existing = configByPath.get(configPath);
    if (existing) return existing;

    const errors: string[] = [];
    const host: ts.ParseConfigHost = {
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      // Only compiler options are wanted; enumerating "include" would walk
      // the whole tree, node_modules included, for nothing.
      readDirectory: () => [],
    };
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    let options: ts.CompilerOptions = {};
    if (read.error) {
      errors.push(messageText(read.error));
    } else {
      const parsed = ts.parseJsonConfigFileContent(
        read.config,
        host,
        path.dirname(configPath),
        undefined,
        configPath,
      );
      options = parsed.options;
      for (const error of parsed.errors) {
        // 18003: "No inputs were found" — expected, since readDirectory is stubbed.
        if (error.code !== 18003) errors.push(messageText(error));
      }
    }

    const config = makeConfig(options);
    configByPath.set(configPath, config);
    reports.push({ path: toRelative(root, configPath), errors });
    return config;
  }

  function configFor(dir: string): Config {
    const cached = configByDir.get(dir);
    if (cached) return cached;
    let config: Config;
    const tsconfig = path.join(dir, "tsconfig.json");
    const jsconfig = path.join(dir, "jsconfig.json");
    if (existsSync(tsconfig)) config = loadConfig(tsconfig);
    else if (existsSync(jsconfig)) config = loadConfig(jsconfig);
    else if (!isInside(toRelative(root, dir))) config = defaultConfig;
    else config = configFor(path.dirname(dir));
    configByDir.set(dir, config);
    return config;
  }

  function classifyTarget(absolute: string, specifier: string): ImportOutcome {
    const relative = toRelative(root, absolute);
    if (!isInside(relative)) return { status: "external", target: "outside", path: relative };

    const segments = relative.split("/");
    if (segments.includes("node_modules")) {
      return {
        status: "external",
        target: "package",
        name: isBare(specifier) ? packageName(specifier) : relative,
        installed: true,
      };
    }

    if (targets.parsed.has(relative)) return { status: "internal", to: relative };

    if (isDeclarationFile(relative)) {
      // TypeScript prefers foo.d.ts over foo.js when both exist, but the
      // file that actually gets loaded is foo.js.
      for (const [suffix, implementations] of Object.entries(IMPLEMENTATION_FOR_DECLARATION)) {
        if (!relative.endsWith(suffix)) continue;
        const stem = relative.slice(0, -suffix.length);
        for (const extension of implementations) {
          if (targets.parsed.has(stem + extension)) return { status: "internal", to: stem + extension };
        }
      }
      return { status: "excluded", code: "declaration", path: relative, reason: "type declaration file" };
    }

    const differentCase = parsedByLowerCase.get(relative.toLowerCase());
    if (differentCase) {
      return {
        status: "unresolved",
        code: "case-mismatch",
        reason: `import resolves to ${relative} but the file on disk is ${differentCase}; this breaks on a case-sensitive file system`,
      };
    }

    const skipReason = targets.skipped.get(relative);
    if (skipReason) {
      return {
        status: "excluded",
        code: "skipped-target",
        path: relative,
        reason: `target was skipped: ${skipReason}`,
      };
    }

    const excludedSegment = segments.slice(0, -1).find((s) => excludedDirectoryReason(s) !== null);
    if (excludedSegment) {
      return {
        status: "excluded",
        code: "excluded-directory",
        path: relative,
        reason: `inside ${excludedSegment} (${excludedDirectoryReason(excludedSegment)})`,
      };
    }

    if (!isSourceFile(relative)) {
      return {
        status: "excluded",
        code: "non-source",
        path: relative,
        reason: `non-source file (${path.extname(relative) || "no extension"})`,
      };
    }

    return { status: "excluded", code: "not-walked", path: relative, reason: "file was not part of the walk" };
  }

  // Resolution found nothing at `candidate`; say what is actually there.
  function describeMissing(candidate: string, prefix: string, code: "no-file" | "alias-no-file" | "base-url-no-file"): ImportOutcome {
    const relative = toRelative(root, candidate);
    const shown = isInside(relative) ? relative : candidate;
    const stat = statOrNull(candidate);
    if (stat?.isFile()) {
      if (!isSourceFile(candidate)) {
        if (!isInside(relative)) return { status: "external", target: "outside", path: relative };
        return {
          status: "excluded",
          code: "non-source",
          path: relative,
          reason: `${prefix}non-source file (${path.extname(candidate) || "no extension"})`,
        };
      }
      return {
        status: "unresolved",
        code: "not-resolvable",
        reason: `${prefix}${shown} exists but TypeScript's resolver rejects this specifier for it`,
      };
    }
    if (stat?.isDirectory()) {
      return { status: "unresolved", code: "no-index", reason: `${prefix}directory ${shown} has no index file` };
    }
    return {
      status: "unresolved",
      code,
      reason: `${prefix}no file at ${shown} (tried every source extension and as a directory)`,
    };
  }

  function explainFailure(fromAbsolute: string, specifier: string, options: ts.CompilerOptions): ImportOutcome {
    if (/[?!]/.test(specifier)) {
      return {
        status: "unresolved",
        code: "loader-syntax",
        reason: "bundler loader or query syntax (`?` or `!`), not a file path",
      };
    }

    if (isRelative(specifier) || path.isAbsolute(specifier)) {
      return describeMissing(path.resolve(path.dirname(fromAbsolute), specifier), "", "no-file");
    }

    if (specifier.startsWith("#")) {
      return {
        status: "unresolved",
        code: "subpath-import",
        reason: `package.json "imports" entry for ${specifier} did not resolve`,
      };
    }

    // Without baseUrl, TypeScript resolves "paths" against the directory of
    // the config that declared them, which it records as pathsBasePath.
    const pathsBase = typeof options.pathsBasePath === "string" ? options.pathsBasePath : root;
    const aliasBase = options.baseUrl ?? pathsBase;
    for (const [pattern, substitutions] of Object.entries(options.paths ?? {})) {
      const captured = matchPattern(pattern, specifier);
      if (captured === null || substitutions.length === 0) continue;
      const substituted = substitutions[0].replace("*", captured);
      return describeMissing(
        path.resolve(aliasBase, substituted),
        `path alias ${pattern} matched; `,
        "alias-no-file",
      );
    }

    if (options.baseUrl) {
      const first = specifier.split("/")[0];
      if (existsSync(path.join(options.baseUrl, first))) {
        return describeMissing(path.resolve(options.baseUrl, specifier), "via baseUrl; ", "base-url-no-file");
      }
    }

    // Nothing is installed to resolve against, so the specifier only counts as
    // a package if the repository says it is one.
    const name = packageName(specifier);
    const workspaceManifest = workspacePackages.get(name);
    if (workspaceManifest) {
      return {
        status: "unresolved",
        code: "workspace-package",
        reason: `${name} is the name of ${workspaceManifest} in this repository; resolving it needs node_modules installed`,
      };
    }
    if (isDeclared(toRelative(root, fromAbsolute), name)) {
      return { status: "external", target: "package", name, installed: false };
    }
    return {
      status: "unresolved",
      code: "undeclared-package",
      reason: `bare specifier ${specifier} is not installed and no package.json up to the root declares ${name}`,
    };
  }

  return {
    resolve(fromRelative, specifier) {
      if (isBuiltin(specifier)) {
        return { status: "external", target: "builtin", name: specifier.replace(/^node:/, "") };
      }
      const fromAbsolute = path.join(root, fromRelative);
      const config = configFor(path.dirname(fromAbsolute));
      const { resolvedModule } = ts.resolveModuleName(
        specifier,
        fromAbsolute,
        config.options,
        ts.sys,
        config.cache,
      );
      if (resolvedModule) return classifyTarget(resolvedModule.resolvedFileName, specifier);
      return explainFailure(fromAbsolute, specifier, config.options);
    },
    configs: () => [...reports].sort((a, b) => (a.path < b.path ? -1 : 1)),
  };
}

function isRelative(specifier: string): boolean {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
}

function isBare(specifier: string): boolean {
  return !isRelative(specifier) && !path.isAbsolute(specifier) && !specifier.startsWith("#");
}

function isBuiltin(specifier: string): boolean {
  if (specifier.startsWith("node:")) return true;
  return builtinModules.includes(specifier) || builtinModules.includes(specifier.split("/")[0]);
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
}

// tsconfig "paths" patterns contain at most one "*".
function matchPattern(pattern: string, specifier: string): string | null {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === specifier ? "" : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (specifier.length < prefix.length + suffix.length) return null;
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

function statOrNull(absolute: string) {
  try {
    return statSync(absolute);
  } catch {
    return null;
  }
}

function messageText(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
}
