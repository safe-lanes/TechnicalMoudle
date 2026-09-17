-- 140: Seed view_modes_master + role_view_mode_mapping (Task #324)
--
-- Behaviour-neutral seed replacing the hardcoded mapLoggedRoleToUIRole logic
-- (shared/uiRoles.ts). The CASE below IS that function, verbatim:
--   Office: 'Sail Admin'→Sail_Admin, 'Admin'→Tech_Superintendent,
--           'External 10'→External, anything else→Client_Admin
--           (yes, Super Admin seeds to Client_Admin — today's behaviour; changing
--            it is a product decision, not this migration's job)
--   Ship:   'Vessel Admin'/'Vessel User 3'→Head_of_Dept, anything else→Vessel
-- Roles with any other roletype get NO mapping (mapLoggedRoleToUIRole returns
-- null for them today).
--
-- Deliberate behaviour delta (the point of the feature): roles created AFTER
-- this seed are BLOCKED until an admin maps them — no more default-open
-- fallthrough.
--
-- Runs on BOTH shore and ship (all environments migrate identically). Sync
-- identity = natural keys (code / role_ruid), so both-side seeding converges
-- instead of duplicating (approval_workflow_config lesson).
-- Idempotent: ON CONFLICT (natural key) DO NOTHING — re-run inserts zero rows.

INSERT INTO view_modes_master (code, display_name, description, sort_order)
VALUES
  ('Sail_Admin',          'Sail Admin',     'Full system administration (SAIL)',            1),
  ('Client_Admin',        'Client Admin',   'Client-side administration',                   2),
  ('Tech_Superintendent', 'Superintendent', 'Technical superintendent (office)',            3),
  ('Head_of_Dept',        'Head of Dept',   'Head of department (vessel)',                  4),
  ('Vessel',              'Vessel',         'Vessel crew user',                             5),
  ('External',            'External',       'External / third-party user',                  6)
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint

INSERT INTO role_view_mode_mapping (role_ruid, view_mode_code)
SELECT r.ruid,
  CASE
    WHEN r.roletype = 'Office' AND r.assigned_role = 'Sail Admin'  THEN 'Sail_Admin'
    WHEN r.roletype = 'Office' AND r.assigned_role = 'Admin'       THEN 'Tech_Superintendent'
    WHEN r.roletype = 'Office' AND r.assigned_role = 'External 10' THEN 'External'
    WHEN r.roletype = 'Office'                                     THEN 'Client_Admin'
    WHEN r.roletype = 'Ship' AND r.assigned_role IN ('Vessel Admin', 'Vessel User 3') THEN 'Head_of_Dept'
    WHEN r.roletype = 'Ship'                                       THEN 'Vessel'
  END
FROM admn_role_master r
WHERE r.roletype IN ('Office', 'Ship')
  AND COALESCE(r.is_active, true) = true
  AND COALESCE(r.is_deleted, false) = false
ON CONFLICT (role_ruid) DO NOTHING;
