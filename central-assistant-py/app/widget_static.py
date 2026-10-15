"""Shared chat widget bundle, served by the assistant (15-Oct-2026, Ghazi: "option A").

GET /widget/<version>/<file> serves ONLY the files listed in that version's integrity.json (no directory listing, no
other paths). Each version folder is immutable, so responses are cached for a year; modules pin a version and an
integrity hash in their own index.html and upgrade/roll back by changing them.
The folder is a copy of packages/sail-assistant-widget/dist/<version>/ made by scripts/sync_widget_bundle.py, which
checks the hashes; this module checks them again at load and refuses a file whose bytes do not match.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

router = APIRouter()

WIDGET_DIR = Path(os.environ.get("ASSISTANT_WIDGET_DIR", str(Path(__file__).resolve().parents[1] / "widget")))
_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
_TYPES = {".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8"}
_HEADERS = {
    "Cache-Control": "public, max-age=31536000, immutable",
    # Public static code, no credentials: any module page may load it, and <script integrity crossorigin> needs CORS.
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
}


def _sri(data: bytes) -> str:
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode()


def load(widget_dir: Path = WIDGET_DIR) -> dict[str, dict[str, bytes]]:
    """{version: {file: bytes}} for every version folder whose files match its integrity.json. Mismatches are skipped."""
    out: dict[str, dict[str, bytes]] = {}
    if not widget_dir.is_dir():
        return out
    for vdir in sorted(p for p in widget_dir.iterdir() if p.is_dir() and _VERSION_RE.match(p.name)):
        try:
            manifest = json.loads((vdir / "integrity.json").read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[assistant] widget {vdir.name}: no readable integrity.json ({e}) — not served")
            continue
        files: dict[str, bytes] = {}
        for name, expected in (manifest.get("files") or {}).items():
            path = vdir / name
            if "/" in name or "\\" in name or Path(name).suffix not in _TYPES or not path.is_file():
                print(f"[assistant] widget {vdir.name}/{name}: missing or not allowed — not served")
                continue
            data = path.read_bytes()
            if _sri(data) != expected:
                print(f"[assistant] widget {vdir.name}/{name}: hash does not match integrity.json — not served")
                continue
            files[name] = data
        if files:
            out[vdir.name] = files
    return out


_BUNDLES = load()
print(f"[assistant] widget versions served: {sorted(_BUNDLES) or 'none'}")


@router.get("/widget/{version}/{name}")
async def widget_file(version: str, name: str) -> Response:
    data = _BUNDLES.get(version, {}).get(name)
    if data is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=data, media_type=_TYPES[Path(name).suffix], headers=_HEADERS)
