-- 160: DB-level invariant for the rotation-item master model (Task #366):
-- a stamp may be held (installed) by at most ONE live rotational component per vessel.
-- Application code uses guarded claims, but this index makes the invariant hold
-- even if application logic regresses or races slip through.
CREATE UNIQUE INDEX IF NOT EXISTS uq_components_vessel_current_stamp
  ON components (vessel_id, current_stamp)
  WHERE rotational_item = true
    AND is_deleted = false
    AND current_stamp IS NOT NULL;
