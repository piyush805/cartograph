import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { ImportKind } from "./types.ts";

export interface RawImport {
  line: number;
  kind: ImportKind;
  // null when a dynamic import's argument isn't a literal; `expression` then
  // holds its source text so the report can show what was there.
  specifier: string | null;
  expression: string | null;
  typeOnly: boolean;
}

// The three things that become edges. `require()` and `import x = require()`
// are deliberately not read here.
export function extractImports(file: SourceFile): RawImport[] {
  const found: RawImport[] = [];

  for (const decl of file.getImportDeclarations()) {
    found.push({
      line: decl.getStartLineNumber(),
      kind: "import",
      specifier: decl.getModuleSpecifierValue(),
      expression: null,
      typeOnly: decl.isTypeOnly(),
    });
  }

  for (const decl of file.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (specifier === undefined) continue;
    found.push({
      line: decl.getStartLineNumber(),
      kind: "re-export",
      specifier,
      expression: null,
      typeOnly: decl.isTypeOnly(),
    });
  }

  for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const argument = call.getArguments()[0];
    const literal =
      argument !== undefined &&
      (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument));
    found.push({
      line: call.getStartLineNumber(),
      kind: "dynamic",
      specifier: literal ? argument.getLiteralValue() : null,
      expression: literal ? null : (argument?.getText() ?? "").slice(0, 80),
      typeOnly: false,
    });
  }

  return found.sort((a, b) => a.line - b.line);
}
