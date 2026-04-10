-- Migration: Add Stores sub-menu items (Stores, Lubes, Chemicals, Others)
-- and seed role-menu-access for all active roles

BEGIN;

INSERT INTO adm_menumaster_ac (id, muid, name, display_name, route, parent_menu, is_active, sort_order, created_at, updated_at, is_deleted, is_sync)
VALUES
  (27, gen_random_uuid(), 'pms-stores-stores',    'Stores',    '/stores?tab=stores',    (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1), true, 101, NOW(), NOW(), false, false),
  (28, gen_random_uuid(), 'pms-stores-lubes',     'Lubes',     '/stores?tab=lubes',     (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1), true, 102, NOW(), NOW(), false, false),
  (29, gen_random_uuid(), 'pms-stores-chemicals', 'Chemicals', '/stores?tab=chemicals', (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1), true, 103, NOW(), NOW(), false, false),
  (30, gen_random_uuid(), 'pms-stores-others',    'Others',    '/stores?tab=others',    (SELECT muid FROM adm_menumaster_ac WHERE name = 'pms-stores' LIMIT 1), true, 104, NOW(), NOW(), false, false)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_menu_muid UUID;
  v_role_ruid UUID;
  v_menu_name TEXT;
  v_role_name TEXT;
  v_can_create BOOLEAN;
  v_can_edit BOOLEAN;
  v_can_delete BOOLEAN;
BEGIN
  FOR v_menu_name IN SELECT unnest(ARRAY['pms-stores-stores', 'pms-stores-lubes', 'pms-stores-chemicals', 'pms-stores-others'])
  LOOP
    SELECT muid INTO v_menu_muid FROM adm_menumaster_ac WHERE name = v_menu_name LIMIT 1;
    IF v_menu_muid IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_role_ruid, v_role_name IN SELECT ruid, assigned_role FROM admn_role_master WHERE is_active = true
    LOOP
      IF v_role_name IN ('Sail Admin', 'Super Admin') THEN
        v_can_create := true;
        v_can_edit := true;
        v_can_delete := true;
      ELSE
        v_can_create := false;
        v_can_edit := false;
        v_can_delete := false;
      END IF;

      INSERT INTO adm_role_menu_access (role_ruid, menu_muid, can_view, can_create, can_edit, can_delete, created_at, updated_at)
      VALUES (v_role_ruid, v_menu_muid, true, v_can_create, v_can_edit, v_can_delete, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
