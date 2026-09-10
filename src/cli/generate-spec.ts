#!/usr/bin/env node
import { Command } from 'commander';
import { generateTestSpec } from '../ai/specGenerator.js';
import { logger } from '../utils/logger.js';

const program = new Command();

program
  .name('generate-spec')
  .description(
    "Generate a Playwright test spec from a plain-English scenario, grounded in this framework's Page Objects.",
  )
  .requiredOption('-s, --scenario <text>', 'Plain-English scenario description')
  .option('-o, --out-dir <dir>', 'Output directory for the generated spec', 'tests/generated')
  .parse(process.argv);

const opts = program.opts<{ scenario: string; outDir: string }>();

async function main(): Promise<void> {
  const result = await generateTestSpec(opts.scenario, { outDir: opts.outDir });
  logger.info(`Generated: ${result.filePath}`);
  logger.info(`Page Objects used: ${result.spec.pageObjectsUsed.join(', ')}`);
  logger.info(`Steps: ${result.spec.steps.length}`);
  // eslint-disable-next-line no-console
  console.log('\n--- Structured spec (JSON) ---\n' + JSON.stringify(result.spec, null, 2));
  // eslint-disable-next-line no-console
  console.log('\n--- Generated Playwright test (TypeScript) ---\n' + result.code);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});