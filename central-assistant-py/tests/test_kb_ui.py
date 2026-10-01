"""The knowledge screen's inline script must parse (1-Oct-2026: a duplicate `const note` broke the whole page and no API
test could see it). Skipped where Node.js is not installed."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

UI = Path(__file__).resolve().parents[1] / "app" / "kb_ui.html"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_kb_ui_script_parses(tmp_path: Path) -> None:
    m = re.search(r"<script>(.*)</script>", UI.read_text(encoding="utf-8"), re.S)
    assert m, "inline script not found"
    js = tmp_path / "kb_ui.js"
    js.write_text(m.group(1), encoding="utf-8")
    r = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
