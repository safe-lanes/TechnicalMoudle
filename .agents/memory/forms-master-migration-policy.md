---
name: Forms Master migration policy
description: Owner's migration constraint for Forms Master Stage 1.
---

All database migrations required for Forms Master Stage 1 must be file-based and idempotent.

**Why:** The owners explicitly repeated this requirement when requesting the implementation task; database setup must remain reviewable and repeatable across installations.

**How to apply:** Use checked-in SQL migration files through the existing tracked runner. Do not substitute schema push, manual deployment SQL, inline migration bodies or runtime schema repair.

Forms Master baseline catalogue data must be installed by a separate, tracked,
idempotent SQL data migration after the schema migration, not a recurring
application startup seeder.

**Why:** The owner explicitly rejected startup seeding and requires reviewable,
one-time file-based installation of the default data. Existing customer edits
and identities must not be replaced when changing this mechanism.

**How to apply:** Keep schema creation and baseline insertion in separate SQL
files. The owner's final scope is seeding on EVERY installation (shore and ships)
with exactly the existing UUID-v5 identities and insert-missing-only behavior.
Do not substitute shore-only seeding, migration-time role checks or catalogue
resend/replay. Seed SQL intentionally writes no application audit or sync logs;
normal Office-edit auditing and one-way synchronization remain unchanged.

New role foreign keys must match the installation's actual reference type rather
than trusting the ORM's text declaration.

**Why:** Development metadata showed a native UUID role identity despite a text
ORM declaration. The owner approved matching the new Forms Master Approver column
to the existing reference type without changing existing role/vessel columns.

**How to apply:** Inspect database metadata when adding role references; support
the approved text/native-UUID variants in file-based migrations, while retaining
canonical UUID strings in API contracts. Do not convert existing role data.
