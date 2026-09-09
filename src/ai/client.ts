import Anthropic from '@anthropic-ai/sdk';
import type { ZodType, ZodTypeDef } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { loadConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface StructuredCompletionOptions<T> {
  /** System prompt establishing the assistant's role and constraints. */
  system: string;
  /** The user-turn prompt containing the task and grounding context. */
  userPrompt: string;
  /**
   * Zod schema the response must satisfy. Also used to build the tool's
   * input_schema. Typed with `any` input so schemas using `.default(...)`
   * (whose parsed *output* type differs from its *input* type) are
   * assignable here — we only ever call `.safeParse`, never rely on the
   * input type.
   */
  schema: ZodType<T, ZodTypeDef, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Name for the forced tool call, e.g. "generate_test_spec". */
  schemaName: string;
  /** Description shown to the model for the forced tool call. */
  schemaDescription: string;
  maxTokens?: number;
  /** Deterministic fallback used when running in mock mode (no API key). */
  mockResponse: T | (() => T);
  maxRetries?: number;
}

/**
 * Thin wrapper around the Anthropic SDK that always returns schema-validated,
 * structured JSON — never freeform prose the caller has to parse.
 *
 * Structured output is enforced by forcing a single tool call whose
 * input_schema is derived directly from the Zod schema, so drift between
 * "what we asked for" and "what we validate" is impossible by construction.
 *
 * Falls back to a deterministic mock response when no ANTHROPIC_API_KEY is
 * configured (or AI_MOCK_MODE=true), so the framework — including its unit
 * tests and CI pipeline — runs without live API access.
 */
export class ClaudeClient {
  private readonly client: Anthropic | null;
  private readonly config = loadConfig();

  constructor() {
    this.client = this.config.mockMode ? null : new Anthropic({ apiKey: this.config.anthropicApiKey });
  }

  get isMockMode(): boolean {
    return this.client === null;
  }

  async getStructuredCompletion<T>(opts: StructuredCompletionOptions<T>): Promise<T> {
    if (this.isMockMode) {
      return this.resolveMock(opts);
    }

    const jsonSchema = zodToJsonSchema(opts.schema, { $refStrategy: 'none' }) as Record<string, unknown>;
    const maxRetries = opts.maxRetries ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.client!.messages.create({
          model: this.config.anthropicModel,
          max_tokens: opts.maxTokens ?? 2048,
          system: opts.system,
          messages: [{ role: 'user', content: opts.userPrompt }],
          tools: [
            {
              name: opts.schemaName,
              description: opts.schemaDescription,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              input_schema: jsonSchema as any,
            },
          ],
          tool_choice: { type: 'tool', name: opts.schemaName },
        });

        const toolUse = response.content.find(
          (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use',
        );

        if (!toolUse) {
          throw new Error('Claude response did not include the expected structured tool call.');
        }

        const parsed = opts.schema.safeParse(toolUse.input);
        if (!parsed.success) {
          throw new Error(`Structured response failed schema validation: ${parsed.error.message}`);
        }
        return parsed.data;
      } catch (err) {
        lastError = err;
        logger.warn(
          `Claude structured completion attempt ${attempt + 1}/${maxRetries + 1} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt < maxRetries) {
          await sleep(500 * 2 ** attempt);
        }
      }
    }

    throw new Error(
      `Claude structured completion failed after ${maxRetries + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private resolveMock<T>(opts: StructuredCompletionOptions<T>): T {
    logger.info(`[mock-mode] Using deterministic mock response for "${opts.schemaName}" (no ANTHROPIC_API_KEY set)`);
    const mock = typeof opts.mockResponse === 'function' ? (opts.mockResponse as () => T)() : opts.mockResponse;
    const parsed = opts.schema.safeParse(mock);
    if (!parsed.success) {
      throw new Error(
        `Internal error: mock response for "${opts.schemaName}" failed its own schema: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}