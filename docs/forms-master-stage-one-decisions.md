# Forms Master Stage 1 — approved execution decisions

Recorded from the owner's explicit confirmation on 2026-11-09:

- Domain plan approval: Jeevan Naik — 09-11-2026.
- Synchronization sign-off: Nilesh - Jeevan Naik — 09-11-2026.
- The proposed implementation plan and the following policies were approved as written.

1. Approvers are active, non-deleted `admn_role_master` roles, not ranks; isolate the lookup.
2. Replicate the entire catalogue, including vessel-specific records, to every ship. All ship users may view it; vessel scope expresses applicability, not a replication restriction.
3. Fleet/Vessel scope is immutable after creation. Generated identifiers are never rewritten.
4. Every identified Office user, including Sail Admin and PMS Admin, needs the explicit matching `admin-masters` action. No admin bypass. Restore uses edit permission.
5. Missing identity cannot write. No mock-admin or preview write exception.
6. Mandatory audit and outbound-log failures roll back business writes. Actual default inserts use system-attributed audits; skipped defaults emit nothing.
7. Feature-specific additive schema and checked-in idempotent SQL migrations are a narrow exception to module-extraction prohibitions. No unrelated schema or generic sync-engine refactoring.

Only Forms Master catalogue behavior is authorized. Existing Form Builder, Certificates persistence, Jobs, Work Orders, approvals and scheduling are outside this work.

## Verified identity enforcement

The shared preview default user has a UUID that the legacy client forwards as
though it came from login. Forms Master does not accept forwarded UUID/role/type
headers as authentication for **any** user. Every read and mutation requires
an actual verified matching login: the existing tenant-verified identity, or
signature verification with the existing single-tenant JWT key. Actor UUID,
Office/Ship type and role must all match the verified claims. Missing/invalid
credentials, missing claims and mismatches are rejected. There is no
single-tenant key fallback for requests in multi-tenant mode.
Other modules' authentication/preview behavior is unchanged.

## Approved reference-type adjustment

The owner subsequently approved “Approve matching reference types.” Development
database metadata showed `admn_role_master.ruid` is native PostgreSQL `uuid`,
despite the existing ORM declaration using text. `vessels.vuuid` is text.
The migration therefore inspects the existing role reference and creates only
the new Approver column with the matching `text` or `uuid` type. API values remain
validated UUID strings. No existing role/vessel column is converted.
