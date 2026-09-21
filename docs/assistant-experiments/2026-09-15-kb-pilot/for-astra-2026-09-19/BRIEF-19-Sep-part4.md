# Your five points — all accepted, two of them against my own reporting

No model calls in this round. Live, nginx, SMS RAG, every other site and all shared credentials untouched;
nothing deployed, nothing pushed; no application authentication or permission code changed.

---

## 1. `wo-phr-01` — false failure, corrected

Work-order judge **`.13`**: the office-qualifier test now judges only the units that **assert** the condition. A
mention of the switch inside a negated clause — "The Ship does not have this switch requirement." — is the
correct contrast, not an unqualified office claim. The base judge has had this negation awareness since `.5`;
this test never did.

`wo-phr-01` F1 run 1: **fail → PASS.**

## 2. `wo-phr-05` — you are right, and I was wrong

I reported this as a judge error only. It is a **real answer defect** and it still fails.

- the answer's own step: *"In the Office, the vessel's **office work-order generation switch must be ON**."*
- the answer's conclusion: *"the office switch and Sail Admin restriction apply only to the relevant
  planned-generation actions, **not to per-job Generate WO** or unplanned work orders."*

The switch does apply to per-job 'Generate WO'; only the Sail Admin restriction does not. The answer requires it
and then excludes it.

The judge's *reason* was also wrong — a bare "sail admin" substring test firing on a correctly negated sentence.
`.13` therefore does two separate things: it makes that test negation-aware, **and** it adds a test for the
defect that is actually present (`switch_applicability_contradiction`). **The run stays FAIL, now for the true
reason.** Both failures were not converted into passes.

**Validation over all ten stored work-order dumps** (`wo-judge13-validation.txt`, `wo-judge13-resolution.txt`):
3 rule-level changes, 2 verdict changes.

| run | .12 | .13 | reading |
|---|---|---|---|
| s7 · wo-phr-01 · F1 r1 | fail | **PASS** | the false failure, as you ruled |
| s7 · wo-phr-05 · F1 r3 | fail | **fail** | verdict kept, reason replaced |
| s4 · wo-generic-03 · D2-hybrid r3 | PASS | **fail** | the same self-contradiction on a historical arm, previously unnoticed |

`JUDGE_VERSION = 12` reproduces the old scores exactly.

## 3. The chunking fix — agreed, and it is the one thing that is settled

Nothing further done here.

## 4. Citation verification — you are right twice, and the second one is worse than you thought

**(a) The count.** 46 flags = **23 distinct runs × 2**, across four work-order cases. My report said "46 cases".
Corrected.

**(b) Chasing them found a bug in my own evidence tooling.** The per-run pack showed a KB pilot file marked
*"supplied to the model: no"* on a run whose answer plainly used it. The excerpt-header parser split
`(<document> — <section>)` at the **first** em dash — and the KB pilot filenames contain one
(`…: Office 'Generate Now' — generate a vessel's due work orders…`). So every citation to those files looked
unsupplied. Fixed in judge `.9` (resolve the document against the corpus list, longest match first).
**With the parser fixed the unresolved count is 0.** The flags were mine, not the cases'. The
"work-order cases name their manual as bare 'Technical'" point stays open, but it was not the cause.

**(c) Your substantive point is accepted and now stated in the tooling.** Finding a required phrase in a
supplied document does not prove that document supports the answer's claims. The value is renamed
`phrase-present`, described as **necessary, not sufficient**, and every citation pass resting on it alone is
reported as **PROVISIONAL** in its own column. On this run that is *every* citation pass: frozen 36/36,
corrected 42/42, manual coverage 162/162, work orders 24/24 per arm. Making it conclusive needs a claim-level
check against the supplied text; that does not exist and was not built here.

## 5. The disagreement figure — you are right, 18 of 261 = 6.9 %

`s7-input-identity.txt` said 261 all along. I quoted 228 / 7.9 % from an **earlier partial run** of the analysis,
made while the corrected-claims suite was re-running, which passed four dumps instead of five — 11
identical-input cases, 33 paired runs short. 261 − 33 = 228. I never re-read the regenerated file.
87 × 3 = **261**, 18 disagreements, **6.9 %**. Corrected in the report in place, with the correction marked.

---

## The run, re-scored (judge `.9`, work-order `.13`) — `score8-s7.txt`

| suite | runner's rule | F0 | F1 | other rule | first-source | citation provisional |
|---|---|---|---|---|---|---|
| routing 13 | all three | 13 | 13 | — | — | — |
| retrieval 18 | all three | 18 | 18 | — | — | — |
| frozen 12 | majority | 12 | 12 | all-three 11 → 12 | 33/36 both | 36/36 both |
| corrected claims 14 | majority | 13 | 13 | all-three 13 → 13 | 39/42 → 36/42 | 42/42 both |
| work orders 8 | all three | **8** | **7** | majority 8 → 8 | 24/24 both | 24/24 both |
| manual coverage 57 | all three | 35 | 34 | majority 39 → 39 | 120/171 both | 162/162 both |
| fresh validation 10 | all three | 10 | 10 | majority 10 → 10 | — | — |

Work orders 6 → **7** of 8 on the corrected arm: one false failure removed, **one real defect kept**.
Unresolved citation reviews: **0**. Attribution unchanged — 87 of 101 questions had identical supplied excerpts,
observed pass/fail disagreement on those **18 of 261**, all in the frozen and manual-coverage suites, none in the
work-order suite.

## What actual chatbot defect remains

1. **`wo-phr-05` run 3's self-contradiction** — requires the office switch for per-job 'Generate WO', then denies
   it applies. One run of three; the same contradiction appears once on a historical arm. **Nothing has been
   changed to address it.** It is an answer behaviour, not a test or a document problem, and it is the first item
   for any future prompt or content work.
2. Corrected-claims case 01 fails all three runs on **both** arms (answer check). Pre-existing.
3. Case 06's first-source ranking still behind the KB pilot file (36/42). Not addressed, per your instruction not
   to shorten the document for ranking.
4. Case 04 "(Operational)" = four documents; work-order cases "Technical" = fourteen. Case-quality, not patched.
5. Audit History routing defect — unchanged, open.
6. Every citation pass is provisional in the sense above.

Position unchanged: **keep live as it is.**
