---
name: Vessel Superintendent lock
description: Durable policy decisions for Superintendent approval enforcement.
---

The Superintendent approval lock is a vessel-scoped policy. A missing vessel
settings row resolves to OFF (notify-only), and an explicit vessel value
overrides the legacy company approval setting. The legacy singleton remains
for historical compatibility but is not an active fallback or fleet-wide
override.

**Why:** Shore users need to opt selected vessels into blocking approval without
changing the behavior of the rest of the fleet.

**How to apply:** Resolve the setting using the work order's vessel at
submission, display, bulk approval, individual approval, and
acknowledgement-time checks. Changes must use the dedicated shore-authorized
vessel endpoint and travel through the existing one-way PMS settings sync.