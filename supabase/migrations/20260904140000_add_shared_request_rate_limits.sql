-- Shared fixed-window request rate limits for server-side authentication flows.
--
-- Buckets live outside the exposed Data API schemas. The public RPC is callable
-- only by the service_role used by trusted server code and runs with the
-- caller's privileges, so it does not introduce a SECURITY DEFINER boundary.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.request_rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT request_rate_limits_pkey PRIMARY KEY (scope, key_hash),
  CONSTRAINT request_rate_limits_scope_check
    CHECK (
      char_length(scope) BETWEEN 1 AND 64
      AND scope ~ '^[a-z][a-z0-9_-]*$'
    ),
  CONSTRAINT request_rate_limits_key_hash_check
    CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT request_rate_limits_request_count_check
    CHECK (request_count >= 0)
);

CREATE INDEX IF NOT EXISTS request_rate_limits_reset_at_idx
  ON private.request_rate_limits (reset_at);

ALTER TABLE private.request_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE private.request_rate_limits
  FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.request_rate_limits
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_request_rate_limit(
  p_scope TEXT,
  p_key_hash TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_request_count INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_scope IS NULL
     OR p_scope <> btrim(p_scope)
     OR char_length(p_scope) NOT BETWEEN 1 AND 64
     OR p_scope !~ '^[a-z][a-z0-9_-]*$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Rate-limit scope must start with a lowercase letter and contain only lowercase letters, numbers, underscores, or hyphens.';
  END IF;

  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Rate-limit key hash must be a lowercase SHA-256 hexadecimal digest.';
  END IF;

  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Rate-limit request limit must be between 1 and 1000.';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Rate-limit window must be between 1 and 86400 seconds.';
  END IF;

  -- Keep cleanup bounded so an authentication request never performs an
  -- unbounded delete. Rows that have been expired for a day are no longer
  -- useful for rate-limit decisions.
  WITH expired AS (
    SELECT bucket.ctid
    FROM private.request_rate_limits AS bucket
    WHERE bucket.reset_at < v_now - interval '1 day'
    ORDER BY bucket.reset_at, bucket.scope, bucket.key_hash
    LIMIT 100
  )
  DELETE FROM private.request_rate_limits AS bucket
  USING expired
  WHERE bucket.ctid = expired.ctid;

  -- The primary-key conflict serializes concurrent consumers of the same
  -- bucket. Expired buckets restart at one; active buckets increment without
  -- resetting or extending the current window.
  INSERT INTO private.request_rate_limits AS bucket (
    scope,
    key_hash,
    request_count,
    reset_at,
    updated_at
  )
  VALUES (
    p_scope,
    p_key_hash,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  ON CONFLICT (scope, key_hash) DO UPDATE
  SET
    request_count = CASE
      WHEN bucket.reset_at <= v_now THEN 1
      ELSE bucket.request_count + 1
    END,
    reset_at = CASE
      WHEN bucket.reset_at <= v_now
        THEN v_now + make_interval(secs => p_window_seconds)
      ELSE bucket.reset_at
    END,
    updated_at = v_now
  RETURNING bucket.request_count, bucket.reset_at
    INTO v_request_count, v_reset_at;

  RETURN QUERY
  SELECT
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    greatest(
      1,
      ceil(extract(epoch FROM (v_reset_at - v_now)))::INTEGER
    ),
    v_reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON TABLE private.request_rate_limits IS
  'Server-only fixed-window counters for authentication request throttling.';

COMMENT ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS
  'Atomically consumes one server-side rate-limit attempt and returns the current decision.';

NOTIFY pgrst, 'reload schema';
