# Case inventory for the bounded routing experiment (reviewer brief, 21-Sep-2026).
#
# The questions are taken VERBATIM from the shipped acceptance suites — never rewritten. The reviewer's
# point 2 was that the earlier lexical demonstration used a hand-written query ("review section office
# users") rather than the user's own question; this file exists so that cannot happen again.
#
# Ground truth per case:
#   expected_module — the module the suite itself declares (or, for the manual-coverage suite, the module
#                     prefix of the expected document, exactly as acceptance_manuals.py derives it).
#   ui_module       — the originating-module context the suite actually sends. Every suite routes through
#                     acceptance_answers.ask(), which always sends context={"module": module}, so in these
#                     runs the UI context EQUALS the expected module. That is a property of the harness,
#                     not of production, and the analysis must not lean on it silently.
#
# The suite files import httpx at module scope and cannot be imported in this environment, so the CASES
# tuples are read with `ast` instead of executed. Only positions 0-2 are read, all of which are literals.
#
#   python build_cases.py            # writes cases.json next to this file
import ast
import json
from pathlib import Path

IND = Path(__file__).resolve().parents[3].parent / "central-assistant-py" / "indexer"
HERE = Path(__file__).resolve().parent


def cases_from_tuples(pyfile: Path) -> list[tuple]:
    """The CASES list of a suite module, read without executing it."""
    tree = ast.parse(pyfile.read_text(encoding="utf-8"))
    for node in tree.body:
        targets = (node.targets if isinstance(node, ast.Assign)
                   else [node.target] if isinstance(node, ast.AnnAssign) else [])
        if any(isinstance(t, ast.Name) and t.id == "CASES" for t in targets):
            value = node.value if isinstance(node, ast.Assign) else node.value
            out = []
            for elt in value.elts:  # type: ignore[union-attr]
                row = []
                for item in elt.elts[:3]:  # type: ignore[union-attr]
                    row.append(item.value if isinstance(item, ast.Constant) else None)
                out.append(tuple(row))
            return out
    raise SystemExit(f"no CASES list in {pyfile}")


def phrasings(pyfile: Path) -> list[tuple]:
    """acceptance_wo.PHRASINGS — the five re-phrasings of the base work-order question."""
    tree = ast.parse(pyfile.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "PHRASINGS"
                                                for t in node.targets):
            return [tuple(i.value for i in elt.elts) for elt in node.value.elts]  # type: ignore[union-attr]
    return []


def build() -> list[dict]:
    out: list[dict] = []

    # answers + generated: (class, question, module, ...) — the ledger keys these by 1-based position
    for suite, fname in (("answers", "acceptance_answers.py"), ("generated", "acceptance_generated.py")):
        for i, (_cls, question, module) in enumerate(cases_from_tuples(IND / fname), start=1):
            out.append({"id": f"{suite}/{i}", "suite": suite, "question": question,
                        "expected_module": module, "ui_module": module, "expected_file": None})

    # work orders: (id, question, module, ...)
    for case_id, question, module in cases_from_tuples(IND / "acceptance_wo.py"):
        out.append({"id": f"wo/{case_id}", "suite": "wo", "question": question,
                    "expected_module": module, "ui_module": module, "expected_file": None})

    # work-order phrasing variants: a separate PHRASINGS list whose module is inherited from the base case
    wo_base_module = cases_from_tuples(IND / "acceptance_wo.py")[0][2]
    for case_id, question, _rule in phrasings(IND / "acceptance_wo.py"):
        out.append({"id": f"wo/{case_id}", "suite": "wo", "question": question,
                    "expected_module": wo_base_module, "ui_module": wo_base_module, "expected_file": None})

    # manual coverage: module is the document's own prefix, as acceptance_manuals.py derives it
    for case in json.loads((IND / "manual_cases.json").read_text(encoding="utf-8")):
        module = case["file"].split(" - ")[0].strip().lower()
        out.append({"id": f"manuals/{case['id']}", "suite": "manuals", "question": case["question"],
                    "expected_module": module, "ui_module": module, "expected_file": case["file"]})

    # fresh: carries its own module, and sends context only when it is set
    for case in json.loads((IND / "fresh_cases.json").read_text(encoding="utf-8"))["cases"]:
        module = case.get("module")
        out.append({"id": f"fresh/{case['id']}", "suite": "fresh", "question": case["question"],
                    "expected_module": module or (case["file"].split(" - ")[0].strip().lower()),
                    "ui_module": module, "expected_file": case["file"]})
    return out


if __name__ == "__main__":
    cases = build()
    (HERE / "cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=1), encoding="utf-8")

    # Reconcile against the questions actually stored in the review ledger, so a case that exists only in
    # one of the two places is visible rather than silently dropped.
    ledger = HERE.parent / "ledger.json"
    if ledger.exists():
        stored = {"/".join(r["id"].split("/")[:2]) for r in json.loads(ledger.read_text(encoding="utf-8"))}
        built = {c["id"] for c in cases}
        print(f"built {len(cases)} cases · ledger has {len(stored)} with stored answers")
        only_ledger = sorted(stored - built)
        only_built = sorted(built - stored)
        if only_ledger:
            print(f"  in ledger, not built ({len(only_ledger)}): {', '.join(only_ledger[:8])}")
        if only_built:
            print(f"  built, no stored answer ({len(only_built)}): {', '.join(only_built[:8])}")
    by_module: dict[str, int] = {}
    for c in cases:
        by_module[str(c["expected_module"])] = by_module.get(str(c["expected_module"]), 0) + 1
    print("expected module:", ", ".join(f"{k}={v}" for k, v in sorted(by_module.items())))
    print(f"UI context sent: {sum(1 for c in cases if c['ui_module'])} of {len(cases)}")
