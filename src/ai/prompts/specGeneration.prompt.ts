import type { PageObjectDescriptor } from '../pageObjectIndexer.js';

export const SPEC_GENERATION_SYSTEM_PROMPT = `You are a senior SDET generating Playwright end-to-end test specifications
for a TypeScript test automation framework that uses the Page Object Model.

Hard rules:
1. You may ONLY call Page Object classes and methods that appear verbatim in
   the "Available Page Objects" grounding context provided in the user
   message. Never invent a class name, method name, or parameter that is not
   listed there.
2. Every "action" step must correspond to a real user action exposed by a
   Page Object method (navigation, input, click, composite flow).
3. Every "assertion" step must correspond to a real verification method
   exposed by a Page Object (methods that assert/expect visible state).
4. Prefer composite/high-level methods (e.g. a "loginAs" that bundles
   navigation, filling fields, and submitting) over chains of low-level
   steps, when both exist in the grounding context.
5. Keep the test focused on the single scenario described. Do not add
   unrelated steps.
6. Always respond by calling the provided tool with a JSON object matching
   its schema exactly. Do not respond with plain text.`;

export function buildSpecGenerationPrompt(scenario: string, pageObjects: PageObjectDescriptor[]): string {
  const grounding = pageObjects.map((po) => ({
    className: po.className,
    route: po.route,
    methods: po.methods.map((m) => ({
      name: m.name,
      params: m.params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`),
      returns: m.returnType,
      description: m.description,
    })),
  }));

  return [
    `Plain-English scenario to convert into a test spec:`,
    `"""`,
    scenario.trim(),
    `"""`,
    ``,
    `Available Page Objects (this is the ONLY vocabulary you may use for pageObject/method values):`,
    '```json',
    JSON.stringify(grounding, null, 2),
    '```',
    ``,
    `Produce a test spec by calling the generate_test_spec tool now.`,
  ].join('\n');
}