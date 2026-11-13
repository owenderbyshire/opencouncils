/**
 * AI settings. Prices are Anthropic's list prices in US dollars per million
 * tokens (https://platform.claude.com/docs/en/about-claude/pricing), used to
 * keep spending under the monthly cap. Update them if the models change.
 */
/** Ask the Record: needs an Anthropic key and switching on with ASK_ENABLED=1, so sign-in can go live without it. */
export const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ASK_ENABLED === "1";

export const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
export const AI_MODEL_FAST = process.env.AI_MODEL_FAST || "claude-haiku-5-5";

/** Hard monthly cap across all users, in pounds. */
export const AI_MONTHLY_BUDGET_GBP = Number(process.env.AI_MONTHLY_BUDGET_GBP || 25);
/** Questions each signed-in user can ask per rolling 24 hours. */
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 10);
/** Conservative exchange rate for converting the dollar prices into pounds. */
export const USD_TO_GBP = Number(process.env.USD_TO_GBP || 0.8);

export const MAX_QUESTION_LENGTH = 500;

const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
};
/** Used for any model not listed above, so the cap still bites. */
const FALLBACK_PRICE = { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1 };

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Cost of one API call in pence. */
export function costPence(model: string, usage: TokenUsage): number {
  const p = PRICES_USD_PER_MTOK[model] ?? FALLBACK_PRICE;
  const usd =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1_000_000;
  return usd * USD_TO_GBP * 100;
}

/**
 * A system prompt marked for Anthropic's prompt cache. Jobs that send the same
 * instructions for item after item read them from the cache, at a small
 * fraction of the input price, for five minutes after each use. A prompt under
 * 512 tokens (with the structured output instructions the API adds) is not
 * cached, and the mark costs nothing. Never put anything that changes between
 * calls, such as today's date, in a cached prompt.
 */
export function cachedSystem(text: string) {
  return [{ type: "text" as const, text, cache_control: { type: "ephemeral" as const } }];
}
