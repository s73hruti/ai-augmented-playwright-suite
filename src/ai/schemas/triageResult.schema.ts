import { z } from 'zod';

export const triageVerdictSchema = z.enum(['flaky', 'real_bug', 'selector_drift', 'environment_issue']);
export type TriageVerdict = z.infer<typeof triageVerdictSchema>;

export const failureTriageItemSchema = z.object({
  testTitle: z.string().min(1),
  testFile: z.string().min(1),
  verdict: triageVerdictSchema.describe(
    'flaky = intermittent/non-deterministic, no code change needed; ' +
      'real_bug = genuine product/application defect; ' +
      'selector_drift = the UI changed and a Page Object locator needs updating; ' +
      'environment_issue = infra/CI/network problem unrelated to the app or test.',
  ),
  confidence: z.number().min(0).max(1).describe('Model confidence in this verdict, from 0 to 1.'),
  reasoning: z.string().min(1).describe('Concise explanation citing evidence from the failure output.'),
  suggestedFix: z.string().min(1).describe('A concrete, actionable next step for a human to take.'),
  relatedSelector: z
    .string()
    .optional()
    .describe('The specific selector or testId implicated, when verdict is selector_drift.'),
});

export type FailureTriageItem = z.infer<typeof failureTriageItemSchema>;

export const failureTriageReportSchema = z.object({
  summary: z.string().min(1).describe('One or two sentence overview of the failure run as a whole.'),
  generatedAt: z.string().describe('ISO-8601 timestamp of when this triage report was produced.'),
  results: z.array(failureTriageItemSchema),
});

export type FailureTriageReport = z.infer<typeof failureTriageReportSchema>;