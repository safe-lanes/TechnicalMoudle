# Component editor draft regressions

Run `node scripts/verify-component-editor.mjs`.

The runner mounts the real full-page `ComponentRegisterAddEdit` in Chromium.
The failed-Spares reproduction enters through the real `Components` page,
selects a fixture component, and clicks its **Edit Component** action.
Other cases use a small host to control same-mounted prop, tree, Add, reopen,
and vessel transitions. Contexts, unrelated dialogs/grids, and reference
catalogs are test doubles. Every API request, including mutations and uploads,
is intercepted. The app server/database is never used.

Requires the existing workspace Chromium at `/repl/tools/bin/chromium`, or
`CHROMIUM_PATH` pointing to an installed compatible browser. No application
Playwright configuration, global query defaults, or dependencies are changed.

## Before/after evidence

`node scripts/verify-component-editor.mjs --baseline-ref=<pre-fix-git-ref>`
bundles the original editor with the same real Components entry action and
fixtures. Before committing this change, `--baseline` uses the original `HEAD`.
It intentionally exits nonzero on the old defect.

Observed before: Spares GET returned 503; after clicking Model once and typing
`AUTOTEST123` character by character, Model was `""`.

Observed after: the same test retains `AUTOTEST123`, Backspace produces
`AUTOTEST12`, and insertion after the first character produces
`AMIDUTOTEST12`, with focus retained and caret at position 4.
The visible Spares load error still identifies an unavailable/out-of-date
section, not an empty successful result.

Evidence is generated under ignored `generated-artifacts/component-editor/`:
baseline/results JSON and browser images. A test-only source insertion observes
the existing spares state because the current editor maps spares but has no
rendered spares table. This does not add application instrumentation.

## Covered scenarios

- Failed Spares, Jobs, and component-list requests; pending requests followed
  by successful arrival; continuous typing, Backspace, insertion, focus/caret.
- Repeated related-list and details-cache updates leave the draft and original
  active-status baseline intact; jobs and mapped spares update independently.
- Editing Component Code to another existing record's code cannot display or
  deactivate that record's jobs, including after Jobs refresh. Only deliberate
  record/tree selection retargets the Jobs list.
- Late component lists expand missing ancestors once. Refresh does not reopen
  user-collapsed ancestors or select the original record.
- Prop record changes and same-instance tree selection survive delayed original
  details responses. The prop-selected edit saves to the new prop record.
- Edit-to-Add clears related state and creates rather than patches, even with
  pending old details. Initial parent-based Add waits for lists to generate its
  code without replacing typed text.
- Discard/reopen clears drafts. Vessel transitions with loaded or pending
  details clear the old draft and do not allow a cross-vessel Save.
- Unchanged active, active-to-inactive, already-inactive, and failed inactivation
  request sequencing; a failed inactivation does not PATCH or discard the draft.
- Text-only Save preserves running hours, inherited master, stamp, timestamps,
  critical/condition/rotational/class flags, and null/false/zero default mapping.
  RH source and classification persistence remain exactly as before.
- Failed PATCH, background detail reload, successful retry, and save/reopen.
- Successful create, edit, and create-then-new-job navigation.

## Existing issues deliberately not corrected

Both original and updated code reproduce a separate identity mismatch:
with prop component `a` (code `601`), choosing tree code `602` displays that
record and stores `602` as selectedComponentId, but Save PATCHes `a` with
componentCode `602`. Tree IDs are display codes; Save and document/history
operations prefer the original prop ID. The tree loader also does not establish
a new original-active baseline. The tests assert and label this existing
behavior, **not** as desired correctness. Unifying selection, mutation,
active-status, and independent-operation identities requires separate approval;
it was not silently introduced in a hydration fix.

The original editor could also retain details from another vessel when used
without its parent. The real Components page already closes the editor on a
vessel transition. Session remounting plus the detail-vessel check now prevent
old responses/drafts from being combined with a new vessel even in the isolated
host. Save before compatible details load is rejected with visible feedback.

## Environment finding

Fault injection proves a client state-reset defect, **not** that a particular
request is failing on the user's development server. No existing user record
was saved by these tests. To identify that separate trigger, capture the dev
browser Network panel while opening Edit Component and inspect:

- `/technical/api/spares`
- `/technical/api/jobs?vesselId=<selected-vessel>`
- `/technical/api/components/<selected-vessel>`
- `/technical/api/components/details/<component-id>`

Record HTTP status, pending duration, response error, and request order before
attributing the symptom to a backend failure or permissions.
