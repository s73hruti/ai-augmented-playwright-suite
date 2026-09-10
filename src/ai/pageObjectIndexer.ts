import { Project, type ClassDeclaration } from 'ts-morph';
import fg from 'fast-glob';
import path from 'node:path';
import { logger } from '../utils/logger.js';

export interface PageObjectMethodParam {
  name: string;
  type: string;
  optional: boolean;
}

export interface PageObjectMethod {
  name: string;
  params: PageObjectMethodParam[];
  returnType: string;
  description: string | undefined;
}

export interface PageObjectDescriptor {
  className: string;
  /** Absolute path to the source file this class was declared in. */
  filePath: string;
  /** The page's `path` property literal, e.g. "/menu.html", when statically determinable. */
  route: string | undefined;
  methods: PageObjectMethod[];
}

const PAGES_GLOB = 'src/pages/*.page.ts';
const BASE_PAGE_CLASS = 'BasePage';

/**
 * Statically parses every `*.page.ts` file under src/pages using the
 * TypeScript compiler API (via ts-morph) and extracts a structured
 * description of each Page Object: its class name, route, and public
 * methods (with parameter types and JSDoc).
 *
 * This descriptor list is the "grounding context" fed to the LLM during
 * spec generation, so generated tests can only call methods that actually
 * exist on the framework's Page Objects — eliminating hallucinated
 * selectors or API calls by construction rather than by hoping the model
 * behaves.
 */
export async function indexPageObjects(rootDir: string = process.cwd()): Promise<PageObjectDescriptor[]> {
  const tsConfigFilePath = path.join(rootDir, 'tsconfig.json');
  const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true });

  const files = await fg(PAGES_GLOB, { cwd: rootDir, absolute: true });
  if (files.length === 0) {
    logger.warn(`No page objects found matching ${PAGES_GLOB} under ${rootDir}`);
  }
  project.addSourceFilesAtPaths(files);

  const descriptors: PageObjectDescriptor[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    for (const cls of sourceFile.getClasses()) {
      if (!cls.isExported() || !extendsBasePage(cls)) continue;
      descriptors.push(describeClass(cls, sourceFile.getFilePath()));
    }
  }

  return descriptors.sort((a, b) => a.className.localeCompare(b.className));
}

function extendsBasePage(cls: ClassDeclaration): boolean {
  const extendsExpr = cls.getExtends();
  return extendsExpr?.getText().startsWith(BASE_PAGE_CLASS) ?? false;
}

function describeClass(cls: ClassDeclaration, filePath: string): PageObjectDescriptor {
  const className = cls.getNameOrThrow();
  const route = getRouteLiteral(cls);
  const methods = cls
    .getMethods()
    .filter((m) => m.getScope() === 'public' || m.getScope() === undefined)
    .filter((m) => !m.isStatic())
    .map((m) => {
      const jsDocs = m.getJsDocs();
      const description = jsDocs.length > 0 ? jsDocs[0].getDescription().trim() || undefined : undefined;
      return {
        name: m.getName(),
        params: m.getParameters().map((p) => ({
          name: p.getName(),
          type: p.getType().getText(p).replace(/import\([^)]*\)\./g, ''),
          optional: p.isOptional(),
        })),
        returnType: m.getReturnType().getText(m).replace(/import\([^)]*\)\./g, ''),
        description,
      } satisfies PageObjectMethod;
    });

  return { className, filePath, route, methods };
}

function getRouteLiteral(cls: ClassDeclaration): string | undefined {
  const prop = cls.getProperty('path');
  if (!prop) return undefined;
  const initializer = prop.getInitializer();
  if (!initializer) return undefined;
  const text = initializer.getText();
  const match = text.match(/^['"](.*)['"]$/);
  return match ? match[1] : undefined;
}

/** CLI entry point: `npm run index:pages` prints the grounding context as JSON. */
async function main() {
  const descriptors = await indexPageObjects();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(descriptors, null, 2));
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href;
if (isDirectRun) {
  main().catch((err) => {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}