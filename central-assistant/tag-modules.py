"""One-shot: stamp a `module` metadata tag on every chunk in the knowledge store.

The tag is derived from the staged filename's module prefix ("Audit - ...",
"Technical - ...", etc. — the convention used when staging the manuals). The
service also falls back to the same prefix rule at query time, so this pass
makes the tag explicit in the store per the Stage 1 plan ("one module tag per
chunk") rather than being load-bearing on its own.

Run from the workstation through the SSH tunnel (default), or on the server:
  python tag-modules.py                # expects tunnel on 127.0.0.1:8111
  CHROMA_URL=http://127.0.0.1:8011 python tag-modules.py   # on the server
Idempotent: re-running rewrites the same values.
"""
import json
import os
import urllib.request

CHROMA = os.environ.get("CHROMA_URL", "http://127.0.0.1:8111")
COLLECTION = os.environ.get("CHROMA_COLLECTION", "technical_docs")
BASE = f"{CHROMA}/api/v2/tenants/default_tenant/databases/default_database"
KNOWN = {"technical", "audit", "safety", "incident", "crewing"}


def req(url, payload=None, method=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"),
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        body = resp.read()
        return json.loads(body) if body else None


cols = req(f"{BASE}/collections")
col = next(c for c in cols if c["name"] == COLLECTION)
cid = col["id"]
total = req(f"{BASE}/collections/{cid}/count")
print(f"collection {COLLECTION} ({cid}): {total} chunks")

got = req(f"{BASE}/collections/{cid}/get", {"limit": max(total, 1), "include": ["metadatas"]})
ids, metas = got["ids"], got["metadatas"]

counts, upd_ids, upd_metas = {}, [], []
for i, m in zip(ids, metas):
    m = m or {}
    prefix = (m.get("file", "").split(" - ")[0]).strip().lower()
    module = prefix if prefix in KNOWN else "unknown"
    counts[module] = counts.get(module, 0) + 1
    if m.get("module") != module:
        m["module"] = module
        upd_ids.append(i)
        upd_metas.append(m)

print("module distribution:", json.dumps(counts))
if "unknown" in counts:
    raise SystemExit(f"REFUSING: {counts['unknown']} chunks resolve to no known module — fix filenames first")

BATCH = 200
for i in range(0, len(upd_ids), BATCH):
    req(f"{BASE}/collections/{cid}/update", {"ids": upd_ids[i:i + BATCH], "metadatas": upd_metas[i:i + BATCH]})
print(f"updated {len(upd_ids)} chunks (rest already tagged)")
