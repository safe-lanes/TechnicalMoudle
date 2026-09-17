-- 136: Shipskart role mapping — UI-configurable, many-to-one (many SAIL roles → one
-- Shipskart role). Replaces the hardcoded roleMap in shipskartSsoService. Per-tenant by
-- construction (multi-tenant is database-per-tenant; each tenant DB carries its own rows).
--
-- Layering: this table maps SAIL role → Shipskart ROLE ('captain'|'purchaser'|'manager' —
-- validated in the service against the single role-source seam, NOT a DB CHECK, because the
-- role list will later come from Shipskart's Get Role API per tenant). The Shipskart role →
-- externalUserId account resolution stays in env (SHIPSKART_USER_*) as the TEMPORARY bridge
-- until Shipskart's User Registration API gives us per-user accounts; this table will then
-- also serve the user-registration push (role assignment at user creation).
--
-- Seed mirrors the previous hardcode exactly, so deploying this is behaviour-neutral.
-- Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS shipskart_role_mappings (
  id              SERIAL PRIMARY KEY,
  sail_role       TEXT NOT NULL UNIQUE,   -- one SAIL role → exactly one Shipskart role
  shipskart_role  TEXT NOT NULL,          -- many rows may share this value (many-to-one)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_uuid TEXT
);
--> statement-breakpoint

INSERT INTO shipskart_role_mappings (sail_role, shipskart_role) VALUES
  ('Vessel Admin', 'captain'),
  ('Admin',        'purchaser'),
  ('User',         'manager')
ON CONFLICT (sail_role) DO NOTHING;
