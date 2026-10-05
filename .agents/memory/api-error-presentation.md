---
name: API error presentation compatibility
description: Why module-specific friendly messages must preserve the existing transport error contract.
---

Keep readable user feedback separate from the shared request error representation. Changing that representation globally requires auditing its consumers first.

**Why:** Existing component inactivation feedback parses the status-prefixed JSON error string. Replacing it globally with a plain message while improving Running Hours could break unrelated component behavior.

**How to apply:** For narrowly scoped feedback changes, format errors at the affected UI boundary and retain the original diagnostics. A future shared error redesign must preserve compatibility or update and verify consumers together.
