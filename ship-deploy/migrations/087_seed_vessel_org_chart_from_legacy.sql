DO $$
DECLARE
  default_vessel_id TEXT;
  old_rec RECORD;
  uuid_map JSONB := '{}'::jsonb;
  new_uuid TEXT;
  mapped_parent TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM adm_vessel_org_chart
    WHERE is_deleted = false
    LIMIT 1
  ) AND NOT EXISTS (
    SELECT 1 FROM vessel_org_chart_nodes LIMIT 1
  ) THEN
    SELECT vuuid INTO default_vessel_id FROM vessels ORDER BY created_at ASC LIMIT 1;

    IF default_vessel_id IS NULL THEN
      RETURN;
    END IF;

    FOR old_rec IN
      SELECT rank_id, rank, sort_order, rank_view,
             created_at, updated_at, created_by_uuid, updated_by_uuid
      FROM adm_vessel_org_chart
      WHERE is_deleted = false
      ORDER BY sort_order
    LOOP
      new_uuid := gen_random_uuid()::text;
      uuid_map := uuid_map || jsonb_build_object(old_rec.rank_id, new_uuid);

      INSERT INTO vessel_org_chart_nodes (
        node_uuid, vessel_id, rank_id, node_label, department,
        parent_node_uuid, is_hod, is_assigned, view_mode, sort_order,
        created_at, updated_at, created_by_uuid, updated_by_uuid
      ) VALUES (
        new_uuid, default_vessel_id, old_rec.rank_id, old_rec.rank, NULL,
        NULL, false, false, old_rec.rank_view, old_rec.sort_order,
        old_rec.created_at, old_rec.updated_at, old_rec.created_by_uuid, old_rec.updated_by_uuid
      );
    END LOOP;

    FOR old_rec IN
      SELECT rank_id, parent_rank_id
      FROM adm_vessel_org_chart
      WHERE is_deleted = false AND parent_rank_id IS NOT NULL
    LOOP
      mapped_parent := uuid_map ->> old_rec.parent_rank_id;
      IF mapped_parent IS NOT NULL THEN
        UPDATE vessel_org_chart_nodes
        SET parent_node_uuid = mapped_parent
        WHERE node_uuid = (uuid_map ->> old_rec.rank_id)
          AND vessel_id = default_vessel_id;
      END IF;
    END LOOP;
  END IF;
END $$;
