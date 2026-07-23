// Per-model token bucket rate limiter.
// Prevents hammering Gemini when quota is low and respects retryDelay from 429 responses.

interface Bucket {
  tokens: number;
  lastRefill: number;
  blockedUntil: number; // epoch ms — set when we get a 429 with retryDelay
}

interface ModelConfig {
  rpm: number;      // requests per minute allowed client-side
  maxBurst: number; // max tokens in the bucket
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemini-2.5-flash':       { rpm: 15, maxBurst: 5 },
  'gemini-2.5-flash-image': { rpm: 3,  maxBurst: 2 },
  'gemini-3.1-flash-image': { rpm: 3,  maxBurst: 2 },
};

const DEFAULT_CONFIG: ModelConfig = { rpm: 10, maxBurst: 3 };

const buckets = new Map<string, Bucket>();

function getBucket(model: string): Bucket {
  if (!buckets.has(model)) {
    const cfg = MODEL_CONFIGS[model] ?? DEFAULT_CONFIG;
    buckets.set(model, { tokens: cfg.maxBurst, lastRefill: Date.now(), blockedUntil: 0 });
  }
  return buckets.get(model)!;
}

function refill(model: string): void {
  const cfg = MODEL_CONFIGS[model] ?? DEFAULT_CONFIG;
  const bucket = getBucket(model);
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 60_000; // minutes
  const gained = Math.floor(elapsed * cfg.rpm);
  if (gained > 0) {
    bucket.tokens = Math.min(cfg.maxBurst, bucket.tokens + gained);
    bucket.lastRefill = now;
  }
}

/** Returns true if the request is allowed; false if rate-limited. */
export function canRequest(model: string): boolean {
  refill(model);
  const bucket = getBucket(model);
  if (Date.now() < bucket.blockedUntil) return false;
  if (bucket.tokens <= 0) return false;
  bucket.tokens--;
  return true;
}

/**
 * Call after receiving a 429. Parses retryDelay from the error if available
 * and blocks the model until then.
 */
export function on429(model: string, error: any): void {
  const bucket = getBucket(model);
  // Try to parse retryDelay from Gemini error body
  let delaySec = 60; // default: block for 60s
  try {
    const msg = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
    const match = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
    if (match) delaySec = Math.ceil(parseFloat(match[1]));
  } catch {}
  bucket.blockedUntil = Date.now() + delaySec * 1000;
  bucket.tokens = 0; // drain bucket
  console.warn(`[AI] Model ${model} rate-limited. Blocked for ${delaySec}s.`);
}

/** Returns how many seconds until the model is unblocked (0 = available). */
export function blockedFor(model: string): number {
  const bucket = getBucket(model);
  return Math.max(0, Math.ceil((bucket.blockedUntil - Date.now()) / 1000));
}
