---
name: Running Hours monotonicity
description: Durable integrity rule separating normal RH accumulation from explicit counter resets.
---

Normal Running Hours updates must never decrease a component's latest authoritative live counter. This integrity rule applies even when rate/anomaly validation is disabled and cannot be bypassed by an excessive-increase override. Equal values are idempotent no-ops. Only explicit approved meter-replacement or renewal/reset workflows may reduce a counter.

**Why:** A later-dated lower Work Order reading can otherwise become the winning event and roll live equipment hours backward, producing negative propagation into inherited components and installed rotational-item hours.

**How to apply:** Validate submitted and current values for user feedback, then repeat the comparison against a fresh database read after the component lock and before any component, audit, inherited-child, or stamp write. Sync derivation must preserve higher live values unless the winning event is an approved reset. A genuine Work Order approval may retain a lower completion reading only by skipping RH application, releasing its RH claim, and persisting a distinct skipped outcome; it must never authorize a lower counter write.