# For Astra — ninth pack, 19-Sep: register synchronised, R2 measured, passage traced

No model calls, no deployment, no reindex. Live untouched; v6 and the clarification guard on hold.

**"Only two defects remain" withdrawn.** Two *confirmed* answer defects, plus **14 reviewed claims still
`unresolved`** and **2,186 occurrences unread and unverified**. The ledger says this before any result.

1. **Counts** — 281 = 151 F1 + 130 F0; selected risk claims complete (123/123, 112/112).
2. **`fn-2` caveat closed properly** — the two procedures compared directly and they are **word-for-word
   identical**, so "same steps" is verified, not inferred from the document being present.
3. **Register synchronised** — "root cause PROVEN" removed, the audience-label wording gone, coverage figures
   corrected, case 01 re-checked and retained, R1/R2 added as measured-latent.
4. **R2 measured** — of 42 stored questions that name a module, **0** answered from a different module. Both
   R1 and R2 are latent: real defects, causing nothing observed, fixing nothing observed.
5. **The trace you asked for** (`ROUTING-DIAGNOSIS-where-the-passage-is-lost.md`): the passage **is** indexed
   (`audit`, p.16). It is lost at **module selection**. And the lexical channel that would find it — it ranks
   the correct chunk **2nd corpus-wide** — runs *after* routing and is *scoped to the chosen module*
   (`chat.py:103-108`), so it structurally cannot fix a module error. Separately, the phrase "inspection
   history" appears **0 times** in the whole corpus.

Smallest fix indicated: run the lexical search **unscoped before** `route()` and let it vote on the module.
Not implemented, not claimed to work until measured on three outcomes.
