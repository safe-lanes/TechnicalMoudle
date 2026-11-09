---
name: Forms Master migration policy
description: Owner's migration constraint for Forms Master Stage 1.
---

All database migrations required for Forms Master Stage 1 must be file-based and idempotent.

**Why:** The owners explicitly repeated this requirement when requesting the implementation task; database setup must remain reviewable and repeatable across installations.

**How to apply:** Use checked-in SQL migration files through the existing tracked runner. Do not substitute schema push, manual deployment SQL, inline migration bodies or runtime schema repair. Static default-data seeding is separate from schema migration.

New role foreign keys must match the installation's actual reference type rather
than trusting the ORM's text declaration.

**Why:** Development metadata showed a native UUID role identity despite a text
ORM declaration. The owner approved matching the new Forms Master Approver column
to the existing reference type without changing existing role/vessel columns.

**How to apply:** Inspect database metadata when adding role references; support
the approved text/native-UUID variants in file-based migrations, while retaining
canonical UUID strings in API contracts. Do not convert existing role data.
