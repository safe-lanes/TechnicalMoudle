-- File-based, idempotent migration; applied by the existing tracked SQL runner on shore AND vessel.
-- No historical identity rewrites, field-log backfill or readiness settings.
DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('190_component_class_regulatory_attachments'));
  IF EXISTS (SELECT ccruuid FROM component_class_regulatory WHERE ccruuid IS NOT NULL GROUP BY ccruuid HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate Section H UUIDs must be reconciled before attachment migration';
  END IF;
  -- Older installations can have the same 185 index name but a PARTIAL predicate.
  -- A partial unique index is not an FK target. Reuse a full one if present;
  -- otherwise add a full index without rewriting any historical identities.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indrelid='component_class_regulatory'::regclass AND i.indisunique
      AND i.indisvalid AND i.indpred IS NULL AND i.indnkeyatts=1 AND a.attname='ccruuid'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_section_h_entry_uuid_fk ON component_class_regulatory(ccruuid);
  END IF;
  CREATE TABLE IF NOT EXISTS component_class_regulatory_attachments (
    ccrauuid text PRIMARY KEY,
    class_regulatory_uuid text NOT NULL REFERENCES component_class_regulatory(ccruuid) ON DELETE RESTRICT,
    component_id text NOT NULL REFERENCES components(cuuid) ON DELETE RESTRICT,
    vessel_id text NOT NULL REFERENCES vessels(vuuid) ON DELETE RESTRICT,
    original_filename text NOT NULL,
    file_key text NOT NULL UNIQUE,
    content_type text NOT NULL CHECK (content_type IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
    storage_backend text NOT NULL CHECK (storage_backend IN ('local','object')),
    uploaded_by_uuid text NOT NULL,
    uploaded_by text NOT NULL,
    uploaded_at timestamp NOT NULL DEFAULT now(),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    created_by text NOT NULL,
    updated_by text NOT NULL,
    created_by_uuid text NOT NULL,
    updated_by_uuid text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamp,
    deleted_by_uuid text,
    is_sync boolean NOT NULL DEFAULT false,
    sort_order integer DEFAULT 0,
    CONSTRAINT section_h_attachment_uuid CHECK (ccrauuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
    CONSTRAINT section_h_attachment_lifecycle CHECK (
      (is_deleted AND deleted_at IS NOT NULL AND deleted_by_uuid IS NOT NULL)
      OR (NOT is_deleted AND deleted_at IS NULL AND deleted_by_uuid IS NULL))
  );
  -- Do not let IF NOT EXISTS silently accept an incompatible prior partial rollout.
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'component_class_regulatory_attachments' AND column_name IN
      ('ccrauuid','class_regulatory_uuid','component_id','vessel_id','original_filename','file_key','content_type','file_size','storage_backend',
       'uploaded_by_uuid','uploaded_by','uploaded_at','created_at','updated_at','created_by','updated_by','created_by_uuid','updated_by_uuid',
       'is_deleted','deleted_at','deleted_by_uuid','is_sync','sort_order')) <> 23 THEN
    RAISE EXCEPTION 'Incompatible Section H attachment schema; repair before retrying migration 190';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='component_class_regulatory_attachments'
    AND (data_type <> CASE WHEN column_name IN ('file_size','sort_order') THEN 'integer'
        WHEN column_name IN ('is_deleted','is_sync') THEN 'boolean'
        WHEN column_name IN ('uploaded_at','created_at','updated_at','deleted_at') THEN 'timestamp without time zone'
        ELSE 'text' END
      OR (column_name NOT IN ('deleted_at','deleted_by_uuid','sort_order') AND is_nullable <> 'NO'))
  ) THEN
    RAISE EXCEPTION 'Incompatible Section H attachment column type/nullability; migration 190 refused';
  END IF;
  CREATE INDEX IF NOT EXISTS idx_section_h_attachment_parent ON component_class_regulatory_attachments(class_regulatory_uuid,is_deleted);
  CREATE INDEX IF NOT EXISTS idx_section_h_attachment_vessel ON component_class_regulatory_attachments(vessel_id,is_deleted);
  CREATE INDEX IF NOT EXISTS idx_section_h_attachment_updated ON component_class_regulatory_attachments(vessel_id,updated_at);
END
$migration$;
