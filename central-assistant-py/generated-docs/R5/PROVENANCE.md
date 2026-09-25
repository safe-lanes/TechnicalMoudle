# R5 — §1.1.14.6 restructured so every action arrives complete

Date: 18-Sep-2026 (second reviewer GO). Branch `chatbot-enterprise`. Nothing deployed; the live assistant, its
index and its container are unchanged. No application code was modified.

## Why R5 exists

R4 corrected the **content** of §1.1.14.6 (per-action conditions instead of one blanket rule) but left it as a
single section. Measured on the candidate's captured model input, that section reached the model **truncated**:

```
* Applies to all of the above: n
```

— the enforcement qualification was cut off after one character. Two causes, both in the chunker
(`indexer/chunking.py`, unchanged): it splits **each page's** markdown by headings, then cuts each section into
1200-character pieces with 150 overlap. The R4 section was ~1,900 characters and crossed a page break, so it was
both char-split and orphaned: the tail landed in a headingless "Preamble" chunk.

R5 fixes the structure rather than the wording. It does **not** shorten the document to improve ranking: R5 is
longer than R4 (38 → 50 paragraphs, 4 → 7 parsed pages) and every source reference is preserved.

## What changed

§1.1.14.6 is now a short lead paragraph plus **five sub-sections, one per action**, each starting on its own page:

| sub-section | carries |
|---|---|
| 1.1.14.6.1 Office 'Generate Now' — a whole vessel | what it does · role **and** switch conditions · **enforcement note** |
| 1.1.14.6.2 Office 'Generate Now' — the refusal messages | the three messages verbatim with their codes · a line saying they belong to this action only |
| 1.1.14.6.3 Office per-job 'Generate WO' — one job | what it does · switch and job-state conditions · **no role check** · **enforcement note** |
| 1.1.14.6.4 Unplanned work order | what it does · neither rule applies · **enforcement note** |
| 1.1.14.6.5 Ship generation | always generates; the gate allows a ship before the role and switch tests |

The enforcement note is now **inside each action's own section** instead of being one shared bullet at the end, so
no retrieval can deliver an action's conditions without its qualification. An explicit page break precedes each
sub-heading, which removes the page-straddle that produced the headingless chunk.

Every other paragraph of the document is byte-identical to the revision it was built from (verified
paragraph-by-paragraph before and after the section).

## Measured result in the index (PROVEN, from the database)

`kb-pilot-e`, the isolated set built for this verification:

| page | section | chars | carries its enforcement note |
|---|---|---|---|
| 2 | 1.1.14.6 (lead) | 342 | yes |
| 3 | 1.1.14.6.1 Generate Now | 1087 | **yes** |
| 4 | 1.1.14.6.2 refusal messages | 635 | n/a (messages) |
| 5 | 1.1.14.6.3 per-job Generate WO | 1006 | **yes** |
| 6 | 1.1.14.6.4 Unplanned | 550 | **yes** |
| 7 | 1.1.14.6.5 Ship | 251 | n/a |

**Headingless "Preamble" chunks for this document: 0** (R4 produced one). No section exceeds the 1200-character
piece, so no action is char-split.

## Source revision

Built from the revision the candidate index was actually built from — `d10f3027…`, recovered from git blob
`619dbb92` at commit `972f424d7` and kept as
`generated-docs/R3/Technical - Recent Updates & Changed Behaviours (Operational) Notes.AS-INDEXED-kb-pilot-c.docx`.
The repository's `generated-docs/R3/…docx` is a later revision (R3.2, `71bafc19…`) and is **not** what the index
holds; see `generated-docs/R4/PROVENANCE.md` for that finding. `generated-docs/build_r5.py` rebuilds R5 from the
as-indexed file and is checked in.

Code evidence for every claim in the section is unchanged from R4 and is listed in
`generated-docs/R4/PROVENANCE.md` (PMS revision `origin/replit_dev` @ `44c8fccad`, read-only). The enforcement
note additionally rests on `workOrderGenerationGate.resolveGateRole = forwardedRole || user.role` and
`server/middleware/auth.ts:186,197`; the security reading of that is recorded separately in
`docs/SECURITY-FINDING-2026-09-18-wo-generation-role.md`.

## KB pilot files reconciled in the same set

The KB pilot procedures stated the 'Generate Now' refusal without qualification ("the other two roles see a button
whose every click is refused"). Three files were reconciled so they say the same thing as the document; the wording
of the policy is unchanged, only its enforcement is now qualified, and every `[code: …]` reference is preserved:

| file | change |
|---|---|
| `kb/technical/work-orders/office-generate-now.md` | enforcement note added after "Who can do it (role)"; the exceptions bullet now says a click is refused "whenever that role reaches the server" |
| `kb/technical/work-orders/how-work-orders-are-created.md` | one enforcement sentence after "Normal sign-in and vessel access apply to all", plus "The other two ways have no role condition to enforce" |
| `kb/technical/work-orders/office-generate-wo-per-job.md` | states that, having no role condition, the forwarded-role question does not arise on this path |

`planned-wo-ship-daily-scan.md` and `unplanned-wo.md` were not changed; their stored vectors were reused on
re-index, which the indexer log records (2 reused, 3 embedded).

## Index build (reusing unchanged parses and vectors)

`kb-pilot-e` = a row-for-row copy of `kb-pilot-c` (916 chunks) with only the changed sources re-indexed → **921**.
Verified in the database:

- every document that was not changed: **0 chunk differences** (`EXCEPT` on id + content);
- exactly three KB files differ, the three that were edited;
- vectors: 7 of the document's chunks and 2 of the KB chunks served from the stored-vector cache; 11 + 3 embedded.
  Nothing else in the corpus was re-parsed or re-embedded.
