---
name: API error presentation compatibility
description: Why module-specific friendly messages must preserve the existing transport error contract.
---

Keep readable user feedback separate from the shared request error representation. Changing that representation globally requires auditing its consumers first.

**Why:** Existing component inactivation feedback parses the status-prefixed JSON error string. Replacing it globally with a plain message while improving Running Hours could break unrelated component behavior.

**How to apply:** For narrowly scoped feedback changes, format errors at the affected UI boundary and retain the original diagnostics. A future shared error redesign must preserve compatibility or update and verify consumers together.

For Component Register Maker/Code rejection, keep the backend's complete corrective sentence rather than replacing it with the shorter planning-inventory suggestion.

**Why:** The acceptance example requires that exact sentence; the problem is the HTTP/JSON wrapper, not the validation rule or Maker selection.

**How to apply:** Future copy changes should preserve the specific reason and corrective instruction, and must not silently change which inputs the server accepts.

Do not classify readable field-label prefixes or underscored spare part numbers as diagnostic codes.

**Why:** Broad case-insensitive code detection suppressed useful field validation; matching every uppercase underscore token also risks hiding legitimate spare identifiers and stock quantities.

**How to apply:** Recognize machine codes in diagnostic positions, not every token in a sentence. Include human field labels and underscored spare identifiers in formatter fixtures.
