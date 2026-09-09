-- Migration 149: Shipskart b2b integration — link tables + per-tenant config.
--
-- NUMBERING: 144 REMAINS RESERVED for Phase 1 tri-state — do not take it. 145-148 taken
-- (deprecate / boolean normalise / retry ladder / per-table watermarks). This is 149,
-- verified free at HEAD 2026-07-30. The inherited-RH reconciliation takes next-free at
-- ITS build time (its plan doc says so) — no clash.
--
-- WHAT: SAILERP is master for users/vessels; a shore-side reconciler pushes them to
-- Shipskart's b2b API (create-vessel / create-user / map-user-to-vessel). Shipskart's
-- returned ids MUST be persisted (there are NO lookup endpoints on their side — a lost
-- create response would otherwise leave an entity unmappable forever), and push status
-- must be inspectable per record.
--
-- ALL FOUR TABLES ARE SHORE-ONLY, NO_SYNC (declared in shared/syncConfig.ts): ships never
-- talk to Shipskart; nothing here may ever travel to a vessel.
--
-- NO SEED, DELIBERATELY: the tenant config row is created by the bootstrap endpoint from
-- env (no hardcoded tenant ids in migrations); link rows appear as the reconciler works.
--
-- Idempotent: IF NOT EXISTS throughout; a second run is a clean no-op.

-- Per-tenant b2b state: the ROTATING token pair lives here (survives restarts; the
-- bootstrap seed credentials stay in env). One row per Shipskart tenant.
CREATE TABLE IF NOT EXISTS shipskart_tenant_config (
  id                  integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id           text NOT NULL UNIQUE,
  enabled             boolean NOT NULL DEFAULT false,
  reconciler_enabled  boolean NOT NULL DEFAULT false,
  access_token        text,
  refresh_token       text,
  access_expires_at   timestamptz,
  refresh_expires_at  timestamptz,
  last_bootstrap_at   timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- SAILERP user (master_users.id uuid) → Shipskart user. external identity = OUR uuid,
-- which is ALSO what Shipskart SSO keys on (proven on UAT 2026-07-30).
CREATE TABLE IF NOT EXISTS shipskart_user_links (
  id                 integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uuid          text NOT NULL UNIQUE,
  shipskart_user_id  text,
  push_status        text NOT NULL DEFAULT 'pending',
  last_error         text,
  pushed_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_shipskart_user_links_status ON shipskart_user_links (push_status);
--> statement-breakpoint

-- Our vessel (vessels.vuuid) → Shipskart vessel.
CREATE TABLE IF NOT EXISTS shipskart_vessel_links (
  id                   integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vessel_vuuid         text NOT NULL UNIQUE,
  imo_number           text,
  shipskart_vessel_id  text,
  push_status          text NOT NULL DEFAULT 'pending',
  last_error           text,
  pushed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_shipskart_vessel_links_status ON shipskart_vessel_links (push_status);
--> statement-breakpoint

-- user↔vessel assignments captured from SAILERP's myVessels at login (server never sees
-- the encrypted profile otherwise). Feeds map-user-to-vessel; mapping status rides here.
CREATE TABLE IF NOT EXISTS master_user_vessels (
  id                   integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_uuid            text NOT NULL,
  vessel_id            text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  shipskart_mapping_id text,
  map_status           text NOT NULL DEFAULT 'pending',
  last_error           text,
  mapped_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT master_user_vessels_user_vessel_unique UNIQUE (user_uuid, vessel_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_master_user_vessels_user ON master_user_vessels (user_uuid);
