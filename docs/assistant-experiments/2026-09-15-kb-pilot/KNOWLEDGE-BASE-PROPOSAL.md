# Knowledge Base as Single Source of Truth — Proposal for Review

**Status:** Proposal. Not approved, not started. Seeking critique before any build.
**Author:** Ghazi Anwer
**Context:** SAIL AI Assistant (central chatbot), currently live at assistant.sl-sail.com

---

## 1. Why this is being proposed

The assistant retrieves correctly — 18/18 routing on the frozen suite. The failures that
remain are not retrieval failures. They are source failures:

- **Instructions that exist only inside screenshot images.** The parser reads text, not
  pictures. Confirmed on at least two cases (01, 05): the only statement of a rule is
  rendered inside a PNG callout, so it was never extracted and cannot be retrieved.
- **Manuals behind the product.** The June manuals describe "Generate WO" as an
  unconditional button. The deployed code requires Sail Admin plus a per-vessel switch
  for office generation, and the vessel switch for per-job generation. The manual
  documents neither, and never mentions that planned work orders are generated
  automatically by the ship's daily scanner.
- **Sections that contain no content.** 45 sections across the 25 manuals consist only
  of a cross-reference ("refer to the Spares sub-module"). 26 of them are in Crewing.
  They retrieve and cannot answer.
- **Parse instability.** Re-parsing the same PDF yields different text run to run
  (agentic tier: 1 of 33 pages identical; cost_effective: 4 of 18). Mitigated by a parse
  cache, but the underlying source remains a black box we re-derive rather than own.

Several rounds of tuning — parser tier, document cleanup, cross-reference resolution,
prompt rules, retrieval thresholds — have not fixed these, because none of them address
the source. The proposal is to fix the source.

## 2. What is proposed

A one-time conversion, repeatable on demand, producing a reviewed set of plain-text
documents that become the authoritative knowledge base.

**Stage 1 — Convert.** For each manual PDF: extract the text as today, and additionally
read the content of each screenshot (OCR where sufficient, a vision model where not),
placing that content in the step it belongs to rather than as a trailing caption dump.
Output one markdown file per manual.

**Stage 2 — Review.** A human reads each output once against the source PDF. 25
documents. Anything derived from an image is marked as such so a reviewer knows where to
look hardest. Corrections are made in the markdown, not in the pipeline.

**Stage 3 — Index.** The reviewed markdown becomes the indexed source. The PDF is no
longer parsed at index time.

**Thereafter:** when the product changes, the markdown is edited directly. When an answer
is wrong, the fix is a sentence in a file, not an investigation of a parse pipeline.

## 3. What this is NOT

- **Not model training.** The OpenAI model is unchanged and stateless. Nothing is
  learned, no weights move, no labelled dataset is produced. This builds the corpus the
  model reads at question time.
- **Not annotation for machine learning.** The frozen test cases are a QA checklist, not
  training data.
- **Not a replacement for LlamaParse.** Parsing remains the first step of conversion.

## 4. Claimed benefits

1. Image-only instructions become retrievable text.
2. One editable place where the truth lives — usable beyond the chatbot (help text,
   onboarding, client training, regenerating the manuals themselves).
3. Parse instability leaves normal operation: the indexed source is a file we own, not a
   re-derived artefact.
4. Cross-reference-only sections can be resolved once, in the document, with visible
   attribution, rather than by a resolver at index time.
5. Drift becomes visible and fixable: a wrong answer maps to a wrong line in a readable
   file.

## 5. Known risks, stated up front

- **Vision-model transcription errors.** A model reading a screenshot may misread or
  invent. Mitigation: mark image-derived content explicitly; human review before go-live.
  Open question: is marking plus review sufficient, or is stronger verification needed?
- **Review fatigue.** 25 documents reviewed once, by people already stretched. A
  superficial review would produce false confidence — worse than the current state,
  because the output would carry an implied warrant of correctness.
- **Divergence from the official manuals.** Once the markdown is authoritative and the
  PDFs are not, the two will drift. Clients receive the PDFs. Open question: does the
  markdown regenerate the PDF, or do both have to be maintained?
- **Ownership.** Whoever owns the markdown owns the product documentation. That is a
  role, not a task. Unowned, it decays to the same state as the current manuals.
- **Code-derived content.** Where the manual is wrong and the code is right, the
  documented behaviour comes from reading code. That content is only as current as the
  revision it was read from, and is verified against a repository rather than the running
  system.
- **Scope of code verification.** Only the Technical module's repository is available.
  Crewing, Audit, Safety and Incident cannot be checked against code at all.

## 6. Open questions for review

1. Is conversion-then-review the right shape, or does an editable knowledge base simply
   relocate the maintenance burden without reducing it?
2. What is the minimum review standard that is honest — full read, sampled, or
   review-only-what-is-image-derived?
3. Should the markdown become the master from which PDFs are generated, or should the
   PDFs stay master with the markdown as a derived artefact that must be regenerated?
4. Is there a cheaper intervention that captures most of the value — for example
   extracting image text only on the pages where a test case has failed, rather than a
   full conversion?
5. How should image-derived and code-derived content be marked so the assistant can cite
   provenance honestly to a user?
6. What stops this from becoming a second set of documentation nobody updates?

## 7. What is explicitly not being asked for

No change to retrieval, the prompt, the parser tier, or the live service. No deployment.
This proposal concerns the source corpus only.
