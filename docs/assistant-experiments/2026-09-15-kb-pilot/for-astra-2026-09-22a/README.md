# Cross-reference investigation — 22-Sep-2026. No model calls, no re-index, nothing deployed.

Both reporting corrections applied; both open product questions answered from the code; all 41
references reviewed for meaning; root cause located. **The repair is designed, not applied.**

**Your two reporting points**
- Coverage now stated consistently: 204 re-scored, **144 read in full**, 60 not read.
- `xref_audit.py` no longer asserts that Stores is maintained from Spares. It is now *resolved by
  evidence* rather than assumed — see below.

**Your item 1 — check manuals and code first.** Nothing remains to ask Jeevan on these:
- **Stores is its own screen.** `TechnicalModule.tsx` renders `<Stores />` and `<Spares />` separately;
  `stores/Stores.tsx` has its own filters and its own export (`stores_<tab>_inventory_*.xlsx`). Being
  sent to Spares is wrong, not a genuine screen switch.
- **Surveys edits and exports in place.** `SurveysPage.tsx` edits in the grid and has its own
  PDF/CSV/Excel export, with no reference to Certificates anywhere in the file.
- **CoC goes the other way:** `DefectsCoC.tsx` is its own page but CoC records are created through the
  shared `DefectFormWizard` with `is_coc` set, so those pasted steps genuinely transfer — only the
  captions are wrong.

**Your item 2 — review all 41 for meaning.** 41 entries, **27 distinct bodies, every one read**.
A navigation 13 · B wrong record type/field list 13 · C caption only 37 · D clean 4.
**37 of 41 carry source-specific wording; 4 are clean.** Your four examples are confirmed, plus two
further B-class patterns you had not listed: the **Crew Promotion filter field list** pasted into six
other sub-modules ("refine crew promotion records by Name, Promotion Rank, …"), and **Post Incident
create** pasted into Others ("enter the required incident details … in the Post Incident Test form").

**Root cause, one line:** `indexer/xrefs.py:225` pastes `target.body` verbatim. The framing sentence is
accurate; nothing adapts the body's screen names, record types, field lists or captions.

**Proposed repair (§5) deliberately does NOT rewrite the source text** — rewriting its nouns would make
the quote no longer what the manual says and the citation to it false. Instead the resolved block names
the destination and states that the quoted steps carry the source's screen names, with an extra
adaptation line for the 13 class-A cases. Two things are for the owner, not me: whether that framing
sentence is acceptable in the published KB, and whether class C (caption-only) is worth touching.

Next, once the framing is agreed: change the one paste site, regenerate, **re-index to a separate index
set** (new rows, embedding calls; touches neither `kb-pilot-e` nor any running container), then test the
corrected procedures against the unchanged candidate on the same model, prompt and retrieval settings.
