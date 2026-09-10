import path from 'node:path';
import { ClaudeClient } from './client.js';
import { indexPageObjects, type PageObjectDescriptor } from './pageObjectIndexer.js';
import { testSpecSchema, type TestSpec, type TestStep } from './schemas/testSpec.schema.js';
import { buildSpecGenerationPrompt, SPEC_GENERATION_SYSTEM_PROMPT } from './prompts/specGeneration.prompt.js';
import { writeFileEnsuringDir } from '../utils/fileWriter.js';
import { logger } from '../utils/logger.js';

export interface GenerateTestSpecOptions {
  outDir?: string;
  rootDir?: string;
}

export interface GenerateTestSpecResult {
  spec: TestSpec;
  filePath: string;
  code: string;
}

/**
 * Generates a Playwright test spec from a plain-English scenario, grounded
 * in the framework's existing Page Objects.
 *
 * Pipeline:
 *  1. Statically index src/pages/*.page.ts to build the grounding context.
 *  2. Ask Claude (or, in mock mode, a deterministic heuristic) for a
 *     structured TestSpec whose steps reference only real Page Object
 *     methods.
 *  3. Verify every step against the grounding context — reject anything
 *     hallucinated rather than silently emitting broken code.
 *  4. Render the validated spec to a runnable .spec.ts file under
 *     tests/generated/.
 */
export async function generateTestSpec(
  scenario: string,
  options: GenerateTestSpecOptions = {},
): Promise<GenerateTestSpecResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const outDir = options.outDir ?? 'tests/generated';

  const pageObjects = await indexPageObjects(rootDir);
  if (pageObjects.length === 0) {
    throw new Error('No Page Objects found under src/pages — nothing to ground spec generation on.');
  }

  const client = new ClaudeClient();
  const spec = await client.getStructuredCompletion<TestSpec>({
    system: SPEC_GENERATION_SYSTEM_PROMPT,
    userPrompt: buildSpecGenerationPrompt(scenario, pageObjects),
    schema: testSpecSchema,
    schemaName: 'generate_test_spec',
    schemaDescription: 'Emit a structured, Page-Object-grounded Playwright test specification.',
    mockResponse: () => buildMockSpec(scenario, pageObjects),
  });

  const groundingErrors = validateSpecAgainstGrounding(spec, pageObjects);
  if (groundingErrors.length > 0) {
    throw new Error(
      `Generated spec references Page Objects/methods that do not exist. Refusing to emit broken code:\n` +
        groundingErrors.map((e) => `  - ${e}`).join('\n'),
    );
  }

  const outFile = path.join(rootDir, outDir, `${slugify(spec.title)}.spec.ts`);
  const code = renderSpecToTypeScript(spec, pageObjects, path.dirname(outFile), scenario);

  await writeFileEnsuringDir(outFile, code);
  logger.info(`Wrote generated spec to ${path.relative(rootDir, outFile)}`);

  return { spec, filePath: outFile, code };
}

/** Cross-checks every step's pageObject/method pair against the indexed grounding context. */
export function validateSpecAgainstGrounding(spec: TestSpec, pageObjects: PageObjectDescriptor[]): string[] {
  const byClassName = new Map(pageObjects.map((po) => [po.className, po]));
  const errors: string[] = [];

  for (const usedClass of spec.pageObjectsUsed) {
    if (!byClassName.has(usedClass)) {
      errors.push(`pageObjectsUsed references unknown Page Object "${usedClass}"`);
    }
  }

  for (const [index, step] of spec.steps.entries()) {
    const descriptor = byClassName.get(step.pageObject);
    if (!descriptor) {
      errors.push(`step[${index}]: unknown Page Object "${step.pageObject}"`);
      continue;
    }
    const method = descriptor.methods.find((m) => m.name === step.method);
    if (!method) {
      errors.push(`step[${index}]: "${step.pageObject}" has no method "${step.method}"`);
    }
  }

  return errors;
}

/**
 * Deterministic, always-grounded mock spec used when running without a live
 * Anthropic API key. It composes the standard login -> browse -> checkout ->
 * confirmation flow using only real Page Object methods, while folding
 * scenario keywords (market, payment method, item) into the arguments so the
 * generated test still reflects what was asked for.
 */
function buildMockSpec(scenario: string, pageObjects: PageObjectDescriptor[]): TestSpec {
  const lower = scenario.toLowerCase();

  const market = detectMarket(lower);
  const payment = lower.includes('cash') ? 'cash' : lower.includes('mobile') ? 'mobile' : 'card';
  const daypart = lower.includes('breakfast') ? 'breakfast' : 'allday';
  const itemId = daypart === 'breakfast' ? `${market.toLowerCase()}-bf-01` : `${market.toLowerCase()}-ad-01`;

  const has = (className: string, method: string) =>
    pageObjects.some((po) => po.className === className && po.methods.some((m) => m.name === method));

  const steps: TestStep[] = [];

  if (has('LoginPage', 'loginAs')) {
    steps.push({
      type: 'action',
      pageObject: 'LoginPage',
      method: 'loginAs',
      args: ['4821', '1234', market],
      comment: `Log in to the ${market} register as attendant of store 4821.`,
    });
  }

  if (has('MenuPage', 'gotoForMarket')) {
    steps.push({
      type: 'action',
      pageObject: 'MenuPage',
      method: 'gotoForMarket',
      args: [market, JSON.stringify({ daypart })],
      comment: `Open the ${daypart} menu for market ${market}.`,
    });
  }

  if (has('MenuPage', 'addItemToOrder')) {
    steps.push({
      type: 'action',
      pageObject: 'MenuPage',
      method: 'addItemToOrder',
      args: [itemId],
      comment: `Add item "${itemId}" to the order.`,
    });
  }

  if (has('MenuPage', 'expectCheckoutEnabled')) {
    steps.push({
      type: 'assertion',
      pageObject: 'MenuPage',
      method: 'expectCheckoutEnabled',
      args: [true],
      comment: 'Checkout should be enabled once an item is in the cart.',
    });
  }

  if (has('MenuPage', 'proceedToCheckout')) {
    steps.push({
      type: 'action',
      pageObject: 'MenuPage',
      method: 'proceedToCheckout',
      args: [],
      comment: 'Proceed from the menu to checkout.',
    });
  }

  if (has('CheckoutPage', 'checkoutWith')) {
    steps.push({
      type: 'action',
      pageObject: 'CheckoutPage',
      method: 'checkoutWith',
      args: [payment],
      comment: `Complete checkout using ${payment} as the payment method.`,
    });
  }

  if (has('ConfirmationPage', 'expectOrderNumberVisible')) {
    steps.push({
      type: 'assertion',
      pageObject: 'ConfirmationPage',
      method: 'expectOrderNumberVisible',
      args: [],
      comment: 'An order confirmation number should be displayed.',
    });
  }

  const pageObjectsUsed = Array.from(new Set(steps.map((s) => s.pageObject)));

  return {
    title: `${market} ${daypart} order via ${payment} — ${truncate(scenario, 60)}`,
    description: scenario.trim(),
    tags: ['ai-generated', market.toLowerCase(), daypart, payment],
    pageObjectsUsed,
    steps,
  };
}

/**
 * Infers a market code from free-text scenario keywords. Checks whole-word
 * market codes first (so "order" never matches "DE"), then falls back to
 * common demonyms/country names.
 */
function detectMarket(lowerScenario: string): 'US' | 'UK' | 'DE' | 'PT' | 'CA' {
  const codeMatch = (['UK', 'DE', 'PT', 'CA', 'US'] as const).find((m) =>
    new RegExp(`\\b${m.toLowerCase()}\\b`).test(lowerScenario),
  );
  if (codeMatch) return codeMatch;

  if (/german|germany/.test(lowerScenario)) return 'DE';
  if (/british|united kingdom|britain/.test(lowerScenario)) return 'UK';
  if (/portuguese|portugal/.test(lowerScenario)) return 'PT';
  if (/canadian|canada/.test(lowerScenario)) return 'CA';
  return 'US';
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function instanceName(className: string): string {
  return className.charAt(0).toLowerCase() + className.slice(1);
}

function renderArg(arg: string | number | boolean): string {
  if (typeof arg === 'string') {
    // Pass through pre-serialized JSON object literals (from buildMockSpec) verbatim;
    // otherwise treat as a plain string literal.
    const looksLikeJsonObject = arg.trim().startsWith('{') && arg.trim().endsWith('}');
    return looksLikeJsonObject ? arg : JSON.stringify(arg);
  }
  return JSON.stringify(arg);
}

function renderSpecToTypeScript(
  spec: TestSpec,
  pageObjects: PageObjectDescriptor[],
  outDirAbs: string,
  scenario: string,
): string {
  const byClassName = new Map(pageObjects.map((po) => [po.className, po]));

  const imports = spec.pageObjectsUsed
    .map((className) => {
      const descriptor = byClassName.get(className);
      if (!descriptor) throw new Error(`Cannot render import for unknown Page Object "${className}"`);
      const relDir = path.relative(outDirAbs, path.dirname(descriptor.filePath)) || '.';
      const fileBase = path.basename(descriptor.filePath).replace(/\.ts$/, '.js');
      const importPath = `${relDir.split(path.sep).join('/')}/${fileBase}`;
      const normalized = importPath.startsWith('.') ? importPath : `./${importPath}`;
      return `import { ${className} } from '${normalized}';`;
    })
    .join('\n');

  const instantiations = spec.pageObjectsUsed
    .map((className) => `  const ${instanceName(className)} = new ${className}(page);`)
    .join('\n');

  const stepLines = spec.steps
    .map((step) => {
      const varName = instanceName(step.pageObject);
      const args = step.args.map(renderArg).join(', ');
      const call = `await ${varName}.${step.method}(${args});`;
      const escapedComment = step.comment.replace(/'/g, "\\'");
      return `  await test.step('${escapedComment}', async () => {\n    ${call}\n  });`;
    })
    .join('\n\n');

  // Playwright requires each tag to be prefixed with "@" (e.g. "@smoke").
  const playwrightTags = spec.tags.map((t) => (t.startsWith('@') ? t : `@${t}`));
  const tagsAnnotation =
    playwrightTags.length > 0 ? `{ tag: [${playwrightTags.map((t) => `'${t}'`).join(', ')}] }, ` : '';

  return `import { test, expect } from '@playwright/test';
${imports}

/**
 * AI-GENERATED TEST — produced by \`npm run generate:spec\` from the plain-English
 * scenario below. Regenerate rather than hand-editing where possible.
 *
 * Scenario: ${scenario.trim().replace(/\*\//g, '*\\/')}
 * Generated: ${new Date().toISOString()}
 */
test('${spec.title.replace(/'/g, "\\'")}', ${tagsAnnotation}async ({ page }) => {
  void expect; // available for ad hoc assertions if this file is hand-edited later
${instantiations}

${stepLines}
});
`;
}