-- Seed offline_admin role for ship provisioning
-- This role is restricted to users who manage ship server deployment
-- Only visible to users assigned this role; Sail Admin always has access as superadmin
INSERT INTO admn_role_master (id, ruid, assigned_role, roletype, orderby, is_active, is_deleted)
SELECT
  COALESCE((SELECT MAX(id) FROM admn_role_master), 0) + 1,
  gen_random_uuid(),
  'Offline Admin',
  'Office',
  99,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM admn_role_master WHERE assigned_role = 'Offline Admin'
);
