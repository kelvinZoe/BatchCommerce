type RateLimitRecord = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const records = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number; now?: number }
): RateLimitResult {
  const now = options.now ?? Date.now();
  if (records.size > 10_000) {
    for (const [recordKey, value] of records) {
      if (value.resetAt <= now) records.delete(recordKey);
    }
  }
  const existing = records.get(key);
  const record = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : existing;

  record.count += 1;
  records.set(key, record);

  return {
    allowed: record.count <= options.limit,
    remaining: Math.max(0, options.limit - record.count),
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000))
  };
}

export function resetRateLimitsForTesting() {
  records.clear();
}
