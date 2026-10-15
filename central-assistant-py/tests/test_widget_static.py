"""Widget bundle serving (15-Oct-2026): only manifest-listed, hash-matching files; immutable caching; public CORS."""
from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import widget_static


def _sri(b: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(b).digest()).decode()


def _make(tmp: Path) -> Path:
    v = tmp / "1.2.3"
    v.mkdir(parents=True)
    good, bad = b"console.log('ok')\n", b"tampered\n"
    (v / "w.1.2.3.js").write_bytes(good)
    (v / "w.1.2.3.mjs").write_bytes(bad)
    (v / "notes.txt").write_bytes(b"x")
    (v / "integrity.json").write_text(json.dumps({"version": "1.2.3", "files": {
        "w.1.2.3.js": _sri(good), "w.1.2.3.mjs": _sri(b"original\n"), "notes.txt": _sri(b"x")}}))
    (tmp / "latest").mkdir()  # not a version folder
    return tmp


def _client(tmp: Path, monkeypatch) -> TestClient:
    monkeypatch.setattr(widget_static, "_BUNDLES", widget_static.load(_make(tmp)))
    app = FastAPI()
    app.include_router(widget_static.router)
    return TestClient(app)


def test_serves_matching_file_with_immutable_cache_and_public_cors(tmp_path, monkeypatch):
    r = _client(tmp_path, monkeypatch).get("/widget/1.2.3/w.1.2.3.js", headers={"Origin": "https://crewing.example"})
    assert r.status_code == 200 and r.content == b"console.log('ok')\n"
    assert r.headers["content-type"].startswith("text/javascript")
    assert "immutable" in r.headers["cache-control"] and r.headers["access-control-allow-origin"] == "*"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_refuses_tampered_unlisted_wrong_type_and_traversal(tmp_path, monkeypatch):
    c = _client(tmp_path, monkeypatch)
    for path in ["/widget/1.2.3/w.1.2.3.mjs",       # bytes do not match integrity.json
                 "/widget/1.2.3/notes.txt",         # listed but not a script type
                 "/widget/1.2.3/integrity.json",    # manifest itself is not served
                 "/widget/latest/w.1.2.3.js",       # not a version folder
                 "/widget/9.9.9/w.1.2.3.js",
                 "/widget/1.2.3/..%2F..%2Fapp%2Fmain.py"]:
        assert c.get(path).status_code == 404, path


def test_real_bundle_in_repo_is_served(monkeypatch):
    real = widget_static.load(Path(__file__).resolve().parents[1] / "widget")
    assert "1.0.0" in real and "sail-assistant-widget.1.0.0.js" in real["1.0.0"]
