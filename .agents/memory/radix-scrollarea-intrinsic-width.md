---
name: Radix ScrollArea intrinsic width
description: Prevent long unbroken content from expanding narrow modal lists beyond their visible container.
---

Do not assume `min-width: 0` and text truncation inside a Radix ScrollArea are sufficient to prevent horizontal expansion. When horizontal scrolling is not intended, use a locally bounded vertical scroll container or explicitly constrain both the viewport content and row layout.

**Why:** Radix ScrollArea can size its internal table-like viewport from a long child’s intrinsic width. A modal shell may remain correctly bounded while a filename row silently expands the document width on mobile.

**How to apply:** For modal lists containing filenames or identifiers, use an explicit `minmax(0, 1fr)` text column, non-shrinking controls, horizontal overflow containment, and verify element and document `scrollWidth` at narrow viewports.