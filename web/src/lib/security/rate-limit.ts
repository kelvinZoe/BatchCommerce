import "server-only";

import { createHmac } from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export class RateLimitUnavailableError extends Error {
  constructor(message = "The shared rate limiter is unavailable.") {
    super(message);
    this.name = "RateLimitUnavailableError";
  }
}

export function hashRateLimitIdentifier(
  secret: string,
  scope: string,
  identifier: string
): string {
  return createHmac("sha256", secret)
    .update(scope)
    .update("\0")
    .update(identifier)
    .digest("hex");
}

export async function checkRateLimit(
  scope: string,
  identifier: string,
  options: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(scope)) {
    throw new TypeError("Rate-limit scope is invalid.");
  }
  if (!identifier) {
    throw new TypeError("Rate-limit identifier is required.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1_000) {
    throw new TypeError("Rate-limit request limit is invalid.");
  }
  if (
    !Number.isInteger(options.windowMs) ||
    options.windowMs < 1_000 ||
    options.windowMs > 24 * 60 * 60 * 1_000
  ) {
    throw new TypeError("Rate-limit window is invalid.");
  }

  const environment = getServerEnvironment();
  const keyHash = hashRateLimitIdentifier(
    environment.RATE_LIMIT_HMAC_SECRET,
    scope,
    identifier
  );

  const { data, error } = await createAdminSupabaseClient().rpc(
    "consume_request_rate_limit",
    {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: options.limit,
      p_window_seconds: Math.ceil(options.windowMs / 1_000)
    }
  );

  const result = data?.[0];
  if (
    error ||
    !result ||
    typeof result.allowed !== "boolean" ||
    !Number.isInteger(result.remaining) ||
    !Number.isInteger(result.retry_after_seconds)
  ) {
    if (error) {
      console.error("Shared rate limiter RPC failed", {
        scope,
        error: error.message
      });
    }
    throw new RateLimitUnavailableError();
  }

  return {
    allowed: result.allowed,
    remaining: Math.max(0, result.remaining),
    retryAfterSeconds: Math.max(1, result.retry_after_seconds)
  };
}
