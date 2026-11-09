---
name: Forms Master domain policy
description: Owner-approved Stage 1 boundaries and identity decisions.
---

Forms Master is a separate Office-managed catalogue, not Form Builder or Job/Work Order integration. Approvers mean active roles, not ranks. All catalogue records, including vessel-specific ones, replicate globally and remain visible on ships; vessel scope denotes applicability only. Fleet/Vessel scope is immutable after creation.

**Why:** The owner approved these boundaries to avoid silently changing replication policy or making a stable creation identifier disagree with editable scope.

Forwarded identity headers are not general authentication. Outside the narrow Replit Forms Master development path, every catalogue read/write must bind actor UUID, role and Office/Ship type to signature-verified login claims. Multi-tenant requests always use the tenant-verified principal and never fall back to a single-tenant signing key.

**Why:** The legacy forwarding path can carry development identities or caller-supplied privileged role names without proving who made the request.

**How to apply:** Production, local and all non-Replit Forms Master requests require the real signed-in identity and existing verification flow. Reject missing credentials/claims and header/claim mismatches.

Forms Master alone may use AuthContext's fixed default development user when the exact Replit environment flag is set. Respect explicit logout; the default is only available when AuthContext provides it for Replit. The server must independently require its development runtime and Replit flag, reject multi-tenant mode, resolve the fixed UUID to an active canonical local user, and compare all forwarded identity fields to that fixed identity. Apply the same Office/Ship and explicit admin-masters permission checks as for ordinary users; this is not an arbitrary-header or role bypass. Other modules and global authentication behavior are unchanged.

**Why:** The owner explicitly requested the AuthContext default user as the signed-in Forms Master identity only in Replit, while requiring real signed-in users everywhere else.

**How to apply:** Keep the exception scoped to Forms Master and fail closed for a missing/inactive canonical mapping, wrong environment, explicit logout, mismatched identity, or missing permission.

Tenant defaults must initialize within each tenant's database lifecycle before its pool is exposed; process-wide startup initializes only the default database. Keep seed audits System-attributed and catalogue outbound identity tenant-local.

**Why:** A successful default-database startup does not populate newly connected tenant databases, and the first tenant connection may inherit a user's audit context or the process's cached default sync identity.

**How to apply:** Preserve the existing lazy migration/readiness boundary, run catalogue initialization there, and fail tenant readiness if migration or seeding fails. Do not add runtime schema repair or rely on manual repository seeding.

Keep the role lookup isolated; never rewrite identifiers. Require an identified Office actor on shore and explicit matching admin-masters permissions even for administrators; restore uses edit. Mandatory audit and outbound-log failures must roll back changes; default insertions are system audited, skipped defaults are not.

The feature's additive schema and idempotent file migrations are approved exceptions to module-extraction restrictions, not permission for unrelated schema or generic sync refactoring.
