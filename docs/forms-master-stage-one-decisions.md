# Forms Master Stage 1 — approved execution decisions

Recorded from the owner's explicit confirmation on 2026-11-09:

- Domain plan approval: Jeevan Naik — 09-11-2026.
- Synchronization sign-off: Nilesh - Jeevan Naik — 09-11-2026.
- The proposed implementation plan and the following policies were approved as written.

1. Approvers are active, non-deleted `admn_role_master` roles, not ranks; isolate the lookup.
2. Replicate the entire catalogue, including vessel-specific records, to every ship. All ship users may view it; vessel scope expresses applicability, not a replication restriction.
3. Fleet/Vessel scope is immutable after creation. Generated identifiers are never rewritten.
4. Every identified Office user, including Sail Admin and PMS Admin, needs the explicit matching `admin-masters` action. No admin bypass. Restore uses edit permission.
5. Missing identity cannot write. No general mock-admin or preview write exception.
6. Mandatory audit and outbound-log failures roll back business writes. Actual default inserts use system-attributed audits; skipped defaults emit nothing.
7. Feature-specific additive schema and checked-in idempotent SQL migrations are a narrow exception to module-extraction prohibitions. No unrelated schema or generic sync-engine refactoring.

Only Forms Master catalogue behavior is authorized. Existing Form Builder, Certificates persistence, Jobs, Work Orders, approvals and scheduling are outside this work.

## Subsequent Replit preview policy

The owner later approved a Forms-Master-only exception for the exact AuthContext
default identity when `VITE_APP_ENV` is exactly `replit`. The server independently
requires development mode and single-tenant operation, validates the fixed
identity against the canonical `master_users` record, and derives the effective
role from that record. The ordinary Office/Ship and explicit `admin-masters`
action checks still apply; this is not a permission bypass or a general mock-user
exception. This narrowly supersedes the original blanket preview denial above.

## Verified identity enforcement

Outside the exact Replit gate, Forms Master requires a verified matching login:
the existing tenant-verified identity, or signature verification with the
existing single-tenant JWT key. Actor UUID, Office/Ship type and role must match
the verified claims (missing role/type may only be resolved from the canonical
server-side user record). In the Replit exception, forwarded values must match
the fixed AuthContext default; the server still resolves its effective role
from `master_users` and enforces the same explicit permission checks. Forwarded
headers alone never authenticate arbitrary identities. There is no
single-tenant key fallback for requests in multi-tenant mode.
Other modules' authentication/preview behavior is unchanged.

## Approved reference-type adjustment

The owner subsequently approved “Approve matching reference types.” Development
database metadata showed `admn_role_master.ruid` is native PostgreSQL `uuid`,
despite the existing ORM declaration using text. `vessels.vuuid` is text.
The migration therefore inspects the existing role reference and creates only
the new Approver column with the matching `text` or `uuid` type. API values remain
validated UUID strings. No existing role/vessel column is converted.
