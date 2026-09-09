import { z } from 'zod';

export const testStepSchema = z.object({
  type: z.enum(['action', 'assertion']).describe(
    'Whether this step performs an action (click, fill, navigate) or verifies an outcome (assertion).',
  ),
  pageObject: z
    .string()
    .min(1)
    .describe('Class name of the Page Object this step targets, e.g. "MenuPage". Must be one of pageObjectsUsed.'),
  method: z
    .string()
    .min(1)
    .describe('Exact method name on that Page Object to call. Must exist in the supplied grounding context.'),
  args: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .default([])
    .describe('Positional arguments to pass to the method call, in order.'),
  comment: z
    .string()
    .min(1)
    .describe('One-sentence plain-English description of what this step does and why.'),
});

export type TestStep = z.infer<typeof testStepSchema>;

export const testSpecSchema = z.object({
  title: z.string().min(1).describe('Short, human-readable title for the generated test case.'),
  description: z.string().min(1).describe('One or two sentences summarizing the scenario under test.'),
  tags: z.array(z.string()).default([]).describe('Optional tags, e.g. ["smoke", "checkout", "US"].'),
  pageObjectsUsed: z
    .array(z.string())
    .min(1)
    .describe('Class names of every Page Object referenced by steps, e.g. ["LoginPage", "MenuPage"].'),
  steps: z.array(testStepSchema).min(1).describe('Ordered list of actions and assertions making up the test.'),
});

export type TestSpec = z.infer<typeof testSpecSchema>;