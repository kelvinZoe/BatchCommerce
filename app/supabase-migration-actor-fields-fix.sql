-- ============================================================
-- Shakhis Commerce - Actor Field Trigger Fix
-- Apply this to the already-provisioned project.
-- Makes set_actor_fields safe on tables without created_by/updated_by.
-- ============================================================

CREATE OR REPLACE FUNCTION set_actor_fields()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
  payload JSONB;
BEGIN
  actor_id := current_app_user_id();
  payload := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    IF NOT (payload ? 'created_by') OR COALESCE(payload->>'created_by', '') = '' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('created_by', actor_id));
    END IF;
    IF TG_ARGV[0] IS DISTINCT FROM 'created_only' AND (NOT (payload ? 'updated_by') OR COALESCE(payload->>'updated_by', '') = '') THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', actor_id));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT (payload ? 'updated_by') OR COALESCE(payload->>'updated_by', '') = '' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_by', actor_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
