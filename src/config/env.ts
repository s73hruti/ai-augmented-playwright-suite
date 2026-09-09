import 'dotenv/config';

export interface AppConfig {
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  mockMode: boolean;
  logLevel: string;
}

function resolveMockMode(): boolean {
  const explicit = process.env.AI_MOCK_MODE?.toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return Boolean(process.env.ANTHROPIC_API_KEY) === false;
  // Default: mock mode is on whenever no API key is configured, so the
  // framework is runnable out of the box without credentials.
  return !process.env.ANTHROPIC_API_KEY;
}

export function loadConfig(): AppConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    mockMode: resolveMockMode(),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}