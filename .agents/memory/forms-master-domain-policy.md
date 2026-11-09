---
name: Forms Master domain policy
description: Owner-approved Stage 1 boundaries and authorization decisions.
---

Forms Master is a separate Office-managed catalogue, not Form Builder or Job/Work Order integration. Approvers mean active roles, not ranks. All catalogue records, including vessel-specific ones, replicate globally and remain visible on ships; vessel scope denotes applicability only. Fleet/Vessel scope is immutable after creation.

**Why:** The owner explicitly approved these choices to avoid silently changing replication policy or making a stable creation identifier disagree with editable scope.

Forwarded identity headers are not authentication, even when a UUID looks valid
and the claimed role has explicit grants. Every catalogue read/write must bind
actor UUID, role and Office/Ship type to signature-verified login claims.

**Why:** The legacy forwarding path can send both development identities and
caller-supplied privileged role names without establishing who made the request.
Checking role permissions alone therefore permits impersonation.

**How to apply:** Reuse the tenant-verified principal in multi-tenant mode;
single-tenant verification uses the existing signing-key setup. Reject missing
credentials/claims and all header/claim mismatches. Never fall back to a
single-tenant key when tenant verification is missing.

Tenant defaults must initialize within each tenant's database lifecycle before
its pool is exposed; process-wide startup initializes only the default database.
Keep seed audits System-attributed and catalogue outbound identity tenant-local.

**Why:** A successful default-database startup does not populate newly connected
tenant databases, and the first tenant connection may inherit a user's audit
context or the process's cached default sync identity.

**How to apply:** Preserve the existing lazy migration/readiness boundary, run
catalogue initialization there, and fail tenant readiness if migration or seeding
fails. Do not add runtime schema repair or rely on manual repository seeding.

**How to apply:** Keep the role lookup isolated; never rewrite identifiers. Require an identified Office actor on shore and explicit matching admin-masters permissions even for administrators; restore uses edit. No mock/preview write exemption. Mandatory audit and outbound-log failures must roll back changes; default insertions are system audited, skipped defaults are not.

The feature's additive schema and idempotent file migrations are approved exceptions to module-extraction restrictions, not permission for unrelated schema or generic sync refactoring.
