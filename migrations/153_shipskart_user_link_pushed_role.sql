-- 153: record WHICH role we pushed to Shipskart per user, so role changes in SAILERP
-- can be detected and propagated via PUT /integration/SAIL/update-user-details/{userId}
-- (their 03-Aug collection: item "Update User Role"). Before this, a user whose link was
-- 'pushed' was skipped forever and Shipskart kept the original role.
--
-- pushed_role_id NULL = pushed before this build (remote role unknown) — the reconciler
-- treats NULL as "align once": one idempotent role update, then the stamp is recorded.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; second run is a clean no-op.

ALTER TABLE shipskart_user_links ADD COLUMN IF NOT EXISTS pushed_role_id text;
ALTER TABLE shipskart_user_links ADD COLUMN IF NOT EXISTS pushed_role_name text;
