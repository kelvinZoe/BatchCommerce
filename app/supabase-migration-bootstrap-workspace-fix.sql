-- ============================================================
-- Batch Commerce - Bootstrap Fixes
-- Apply this after the reset schema on the already-provisioned project.
-- Fixes self-serve onboarding issues on existing databases.
-- ============================================================

CREATE OR REPLACE FUNCTION audit_log_write()
RETURNS TRIGGER AS $$
DECLARE
  actor_id BIGINT;
  entity_uuid_val UUID;
  payload JSONB;
  shop_uuid UUID;
BEGIN
  actor_id := current_app_user_id();

  IF TG_OP = 'DELETE' THEN
    payload := to_jsonb(OLD);
  ELSE
    payload := to_jsonb(NEW);
  END IF;

  shop_uuid := NULLIF(payload->>'shop_id', '')::UUID;

  IF shop_uuid IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'insert',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      NULL,
      payload
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'update',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      to_jsonb(OLD),
      payload
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    entity_uuid_val := COALESCE(
      NULLIF(payload->>'order_uuid', '')::uuid,
      NULLIF(payload->>'sale_uuid', '')::uuid
    );

    INSERT INTO audit_log (
      shop_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      entity_uuid,
      before_data,
      after_data
    ) VALUES (
      shop_uuid,
      actor_id,
      'delete',
      TG_TABLE_NAME,
      NULLIF(payload->>'id', '')::BIGINT,
      entity_uuid_val,
      payload,
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
