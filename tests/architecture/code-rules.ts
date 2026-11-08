import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

/** A source file by its path relative to `src`, e.g. `domain/model.ts`. */
export interface SourceFile {
  name: string;
  source: string;
}

/** Layers that run without a browser. */
const PURE_LAYERS = ['domain', 'application', 'engine', 'i18n'];
/** Persistent browser storage is an adapter concern (ADR 0001); the rest gets it injected. */
const STORAGE_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB'];
const STORAGE_LAYERS = ['adapters'];
const BROWSER_GLOBALS = [
  'window',
  'document',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'fetch',
  'navigator',
];
/** Files that build stateful adapters (Drive client, auth, draft store) for the app. */
export const COMPOSITION_ROOTS = ['main.tsx'];
/** Translated text lives in the message catalogs; code refers to it by key. */
const CATALOG_FOLDER = 'i18n/locales/';
/** A letter from a script other than Latin, which can only be untranslated UI text. */
const FOREIGN_LETTER = /[^\P{L}\p{Script=Latin}]/u;
/** React hooks belong to the UI and composition layers. */
const HOOK_LAYERS = ['components', 'app'];
const HOOK_FILES: string[] = [];

const layerOf = (name: string) => name.split('/')[0];

/**
 * Rules that need the syntax tree rather than the import graph:
 * - pure layers use no browser globals, and only adapters touch persistent storage;
 * - dynamic imports name their module literally, so the graph stays complete;
 * - stateful adapter classes (exported from adapters without a base class; implementing a
 *   port does not count) are constructed only in a composition root, so everything else
 *   depends on what it is handed;
 * - `use…` hooks are declared only where React runs;
 * - strings and JSX text in non-Latin scripts appear only in the message catalogs.
 */
export function codeViolations(files: SourceFile[]): string[] {
  const parsed = files.map(({ name, source }) => ({
    name,
    ast: ts.createSourceFile(
      name,
      source,
      ts.ScriptTarget.Latest,
      true,
      name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  }));
  const services = new Set(
    parsed
      .filter(({ name }) => layerOf(name) === 'adapters')
      .flatMap(({ ast }) =>
        ast.statements.filter(
          (node): node is ts.ClassDeclaration =>
            ts.isClassDeclaration(node) &&
            Boolean(node.name) &&
            !node.heritageClauses?.some(
              (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
            ) &&
            Boolean(node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)),
        ),
      )
      .map((node) => node.name!.text),
  );
  const violations: string[] = [];
  for (const { name, ast } of parsed) {
    const layer = layerOf(name);
    const visit = (node: ts.Node) => {
      if (
        PURE_LAYERS.includes(layer) &&
        ts.isIdentifier(node) &&
        BROWSER_GLOBALS.includes(node.text)
      )
        violations.push(`Pure layer uses a browser global: ${name} → ${node.text}`);
      else if (
        !STORAGE_LAYERS.includes(layer) &&
        ts.isIdentifier(node) &&
        STORAGE_GLOBALS.includes(node.text)
      )
        violations.push(`Browser storage outside adapters: ${name} → ${node.text}`);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        !(node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
      )
        violations.push(`Nonliteral import: ${name}`);
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        services.has(node.expression.text) &&
        !COMPOSITION_ROOTS.includes(name)
      )
        violations.push(
          `Adapter built outside a composition root: ${name} → ${node.expression.text}`,
        );
      const declared =
        (ts.isFunctionDeclaration(node) && node.name?.text) ||
        (ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.initializer &&
          (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
          node.name.text);
      if (
        declared &&
        /^use[A-Z]/.test(declared) &&
        !HOOK_LAYERS.includes(layer) &&
        !HOOK_FILES.includes(name)
      )
        violations.push(`Hook outside the UI layers: ${name} → ${declared}`);
      if (
        (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node) || ts.isJsxText(node)) &&
        FOREIGN_LETTER.test(node.text) &&
        !name.startsWith(CATALOG_FOLDER)
      )
        violations.push(`Text outside the message catalogs: ${name} → ${node.text.trim()}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return violations;
}

/** Every `.ts`/`.tsx` file under `root`, named relative to it. */
export function sourceFiles(root: string): SourceFile[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(resolve(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [resolve(dir, entry.name)]
          : [],
    );
  return walk(root).map((path) => ({
    name: relative(root, path),
    source: readFileSync(path, 'utf8'),
  }));
}
