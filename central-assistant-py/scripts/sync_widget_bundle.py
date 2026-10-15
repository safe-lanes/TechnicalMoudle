"""Copy a built widget version into central-assistant-py/widget/<version>/ so the assistant image serves it (15-Oct-2026).

Source: packages/sail-assistant-widget/dist/<version>/ (built with `npm run build` in that package). Copies only the
files listed in integrity.json plus integrity.json and SHA384SUMS, and checks every hash first. An existing version
folder is never changed: versions are immutable — build a new version instead.
Usage: python central-assistant-py/scripts/sync_widget_bundle.py 1.0.0
"""
from __future__ import annotations

import base64
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "packages" / "sail-assistant-widget" / "dist"
DST = ROOT / "central-assistant-py" / "widget"


def sri(data: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()


def main(version: str) -> int:
    src, dst = SRC / version, DST / version
    manifest = json.loads((src / "integrity.json").read_text(encoding="utf-8"))
    files = manifest.get("files") or {}
    for name, expected in files.items():
        if sri((src / name).read_bytes()) != expected:
            print(f"FAIL {name}: hash does not match integrity.json — rebuild the widget")
            return 1
    if dst.exists():
        same = all((dst / n).is_file() and (dst / n).read_bytes() == (src / n).read_bytes() for n in [*files, "integrity.json"])
        print(f"{'OK  already present, identical' if same else 'FAIL already present and DIFFERENT — versions are immutable'}: {dst}")
        return 0 if same else 1
    dst.mkdir(parents=True)
    for name in [*files, "integrity.json", "SHA384SUMS"]:
        if (src / name).is_file():
            shutil.copyfile(src / name, dst / name)
    print(f"OK  copied {len(files)} file(s) + manifest to {dst}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    raise SystemExit(main(sys.argv[1]))
