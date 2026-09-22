# Second comparison after your corrections — 22-Sep-2026. Nothing deployed; live and all other services untouched.

Read `routing-experiment/XREF-RESULTS-v2.md` first. Section 1 maps each of your findings to what was
verified and changed; section 2 reconciles the builds and the unplanned LlamaParse charges (which I
still cannot read from logs — the history API returns 410; the LlamaCloud usage page is needed for the
~12-16 agentic jobs at ~05:00-05:25 UTC).

Headline, 7 frozen cases x 3 arms x 3 runs = 63 answers, judged after fixing Markdown handling:
  baseline     6 correct / 0 limited / 15 incorrect   (my earlier 11/1/9 had 6 judge errors, all baseline)
  repaired_a  18 / 3 / 0    (quote after the adapted steps)
  repaired_b  17 / 3 / 1    (adapted steps as the guidance; quote kept as a labelled audit copy)
The single repaired_b miss is the provenance defect ("The manual notes ..."), not a wrong screen.
Provenance flags: repaired_a 3/21, repaired_b 1/21 - the label reduces but does not remove it.

`ANSWERS-FULL-3arm.txt` has all 63 answers with citations and per-answer reasons. `repair-source/`
holds the resolver, the corrected facts (Stores per view, Surveys editable fields), the indexer with
`--cache-only` (proven to abort with the network disabled), and the diff since the last pack.
