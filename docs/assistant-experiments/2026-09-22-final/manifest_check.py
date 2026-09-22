# Source manifest for the corrected candidate index (reviewer instruction 22-Sep, step 1–2):
# the exact 30 intended sources with full sha256 — 20 unchanged PDF manuals, 5 corrected operational
# documents, 5 reconciled work-order KB files. An incorrect build must fail here, not in a suite.
#
#   python manifest_check.py write                      # write manifest.json from the table below
#   python manifest_check.py sources <sha256sum-output>  # pre-build: every intended file present with the
#                                                          intended hash, NO extra file (documents dir + kb dir)
#   python manifest_check.py index <psql-dump>           # post-build: assistant_documents rows of the new set —
#                                                          exactly 30, every sha as intended, no extras, KB present
#   python manifest_check.py diff <psql-dump-of-other>   # list every difference vs another index set's rows
#
# Every check exits non-zero on the first violation and prints ALL violations. Document COUNT is never
# accepted on its own: each file is matched by name AND full hash.
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# (display name as stored in assistant_documents.file, sha256, kind, revision/provenance)
KB_TITLES = {
    "unplanned-wo.md": "Technical - KB pilot: Create an unplanned work order ('+ Unplanned W.O').md",
    "office-generate-wo-per-job.md": "Technical - KB pilot: 'Generate WO' for one job — from the Components page.md",
    "how-work-orders-are-created.md": "Technical - KB pilot: How work orders are created — the three ways to create a work order.md",
    "office-generate-now.md": "Technical - KB pilot: Office 'Generate Now' — generate a vessel's due work orders from the office.md",
    "planned-wo-ship-daily-scan.md": "Technical - KB pilot: Planned work orders — generated automatically by the ship's daily job-due scan.md",
}
REVISION = {
    "Technical - Bulk Data Import (Operational) User Manual.docx": "R3 (14-Sep, generated-docs/R3)",
    "Technical - Roles & Permissions (Operational) User Manual.docx": "R3.1 (14-Sep, generated-docs/R3)",
    "Technical - Ship-Side (Vessel Crew) Operational Notes.docx": "R3 (14-Sep, generated-docs/R3)",
    "Technical - Sync (Operational) User Manual.docx": "R3 (14-Sep, generated-docs/R3)",
    "Technical - Recent Updates & Changed Behaviours (Operational) Notes.docx": "R6 (22-Sep, generated-docs/R6 = R5 one-page-per-action + A5 correction of §1.1.14.6.2, owner-authorised)",
}
KB_REVISION = {  # kb-r6 = kb-r5 with ONE file extended (the switch applies to both office routes); the other four byte-identical
    "how-work-orders-are-created.md": "kb-r6 (22-Sep, A5 switch-scope sentence added; kb-r5 sha 115db8545d83 superseded)",
}
# Hashes that must NEVER appear: the R2 (10-Sep, pre-correction) generated documents and the other superseded
# Recent Updates revisions. Any of these in a build = abort.
FORBIDDEN = {
    "ba200e864d": "Bulk Data Import R2", "97a3fedab0": "Roles R2", "69857b3898": "Ship-Side R2",
    "083e08c139": "Sync R2", "6a93bd2383": "Recent Updates R2", "d10f302783": "Recent Updates R3-as-indexed (live; superseded by R5)",
    "71bafc19d9": "Recent Updates R3 pre-R4", "d6eed3760c": "Recent Updates R4",
    "7a06bad589": "Recent Updates R5 (carries the wrong 'Both refusals' sentence; superseded by R6)",
    "115db8545d": "how-work-orders-are-created.md kb-r5 (superseded by kb-r6)",
    "13bb400152": "how-work-orders-are-created.md (kb/, unreconciled)", "08021956687f": "office-generate-now.md (kb/, unreconciled)",
    "579102df93": "office-generate-wo-per-job.md (kb/, unreconciled)",
}


def load_sources_txt(p: Path) -> dict[str, str]:
    """sha256sum output → {file: sha}. Skips CONFLICTS/REVIEW (never indexed)."""
    out = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        sha, _, name = line.partition("  ")
        name = name.strip()
        if name.upper() in ("CONFLICTS.MD", "REVIEW.MD", "README.MD"):
            continue
        out[name] = sha.strip()
    return out


def write_manifest() -> None:
    src = load_sources_txt(HERE / "manifest-sources.txt")
    entries = []
    for name, sha in sorted(src.items()):
        if name.endswith(".md"):
            entries.append({"file": KB_TITLES[name], "source_file": name, "sha256": sha, "kind": "kb",
                            "revision": KB_REVISION.get(name, "kb-r5 reconciled (18-Sep), unchanged in kb-r6")})
        else:
            entries.append({"file": name, "source_file": name, "sha256": sha, "kind": "docx" if name.endswith(".docx") else "pdf",
                            "revision": REVISION.get(name, "official manual, unchanged since 11-Sep")})
    assert len(entries) == 30, len(entries)
    (HERE / "manifest.json").write_text(json.dumps({"count": 30, "entries": entries}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("manifest.json written:", len(entries), "entries",
          {k: sum(1 for e in entries if e["kind"] == k) for k in ("pdf", "docx", "kb")})


def manifest() -> dict[str, dict]:
    m = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    assert m["count"] == 30 and len(m["entries"]) == 30
    return {e["file"]: e for e in m["entries"]}


def check_sources(p: Path) -> int:
    """Pre-build. Input: sha256sum output of the documents dir AND the kb dir (concatenated)."""
    m = manifest()
    by_source = {e["source_file"]: e for e in m.values()}
    got = load_sources_txt(p)
    bad = []
    for name, e in by_source.items():
        if name not in got:
            bad.append(f"MISSING source: {name}")
        elif got[name] != e["sha256"]:
            bad.append(f"WRONG HASH: {name}: got {got[name][:12]} want {e['sha256'][:12]} ({e['revision']})")
    for name, sha in got.items():
        if name not in by_source:
            bad.append(f"EXTRA source not in manifest: {name} {sha[:12]}")
        for fp, label in FORBIDDEN.items():
            if sha.startswith(fp):
                bad.append(f"FORBIDDEN revision present: {name} = {label}")
    return report("sources", bad, len(got))


def load_index_dump(p: Path) -> dict[str, tuple[str, int]]:
    """psql -tA output 'file|sha256|chunks' → {file: (sha, chunks)}."""
    out = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        f, sha, ch = line.rsplit("|", 2)
        out[f.strip()] = (sha.strip(), int(ch))
    return out


def check_index(p: Path) -> int:
    m = manifest()
    got = load_index_dump(p)
    bad = []
    for f, e in m.items():
        if f not in got:
            bad.append(f"MISSING in index: {f}")
        elif got[f][0] != e["sha256"]:
            bad.append(f"WRONG HASH in index: {f}: got {got[f][0][:12]} want {e['sha256'][:12]} ({e['revision']})")
        elif got[f][1] < 1:
            bad.append(f"ZERO CHUNKS: {f}")
    for f, (sha, _) in got.items():
        if f not in m:
            bad.append(f"EXTRA document in index: {f} {sha[:12]}")
        for fp, label in FORBIDDEN.items():
            if sha.startswith(fp):
                bad.append(f"FORBIDDEN revision in index: {f} = {label}")
    kb = [f for f in got if "KB pilot" in f]
    if len(kb) != 5:
        bad.append(f"KB files present: {len(kb)} (want 5)")
    return report("index", bad, len(got))


def diff_other(p: Path) -> int:
    m = manifest()
    got = load_index_dump(p)
    print(f"differences between the manifest and {p.name} ({len(got)} rows):")
    n = 0
    for f, e in m.items():
        if f not in got:
            print(f"   manifest only: {f} {e['sha256'][:12]} ({e['revision']})"); n += 1
        elif got[f][0] != e["sha256"]:
            print(f"   DIFFERENT: {f}: manifest {e['sha256'][:12]} vs other {got[f][0][:12]}"); n += 1
    for f, (sha, _) in got.items():
        if f not in m:
            print(f"   other only: {f} {sha[:12]}"); n += 1
    print(f"   {n} source difference(s)")
    return 0


def report(what: str, bad: list[str], n: int) -> int:
    if bad:
        print(f"{what} CHECK FAILED — {len(bad)} violation(s) over {n} files:")
        for b in bad:
            print("   " + b)
        return 1
    print(f"{what} CHECK PASSED — {n} files, all 30 intended sources present with the intended hash, no extras, no forbidden revision")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "write":
        write_manifest()
    elif cmd == "sources":
        sys.exit(check_sources(Path(sys.argv[2])))
    elif cmd == "index":
        sys.exit(check_index(Path(sys.argv[2])))
    elif cmd == "diff":
        sys.exit(diff_other(Path(sys.argv[2])))
    else:
        raise SystemExit("usage: write | sources <file> | index <file> | diff <file>")
