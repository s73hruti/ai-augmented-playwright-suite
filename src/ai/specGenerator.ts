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