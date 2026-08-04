# Shipskart Stage 3 — Spares & Stores Catalogue Push (BUILD PLAN, 2026-08-04)

**Status: PLANNED, NOT BUILT. Scope: spares + stores (Jeevan's recommendation 2026-08-04;
final client scope to be confirmed with Sahil — does NOT block the one-vessel UAT proof).**

Goal: Shipskart's catalogue for our tenant is an EMPTY SKELETON; we are its only writer.
We push OUR spares/stores data into THEIR structure, 1:1, per vessel. We take nothing
back — their catalogue exists so crew can raise purchase orders against our parts list.

---

## 1. Their architecture vs ours — the shape mapping

Shipskart models: **Category (tree) → Product Master (equipment/product) → SKU (the
purchasable part) → Company/Vessel Catalogue entry (which vessel can order it)**.

| Shipskart layer | Our source (spares) | Our source (stores) |
|---|---|---|
| Category | component tree GROUP (SFI level) — name + SFI code | `stores_items.category` (flat, one level) |
| Category hierarchy | component tree parent→child | none (flat) |
| Product Master | the COMPONENT (equipment): name, maker, model, serial | one generic master per stores category ("Stores — {category}") |
| SKU | the SPARE row | the STORES ITEM row |
| Catalogue entry | spare's vessel → their vessel id (from `shipskart_vessel_links`) | same |

Design decisions locked earlier (Ghazi): **mirror 1:1, no dedupe** — per-vessel part
codes stay per-vessel SKUs; product masters are invented from components; nobody else
writes this catalogue so no collision handling against foreign data is needed.

**Stores modelling note (my call, flagged for review during build):** stores items hang
off no equipment, so their product master is synthetic — one per stores category. If
Sahil/client want a different grouping later, only the mapper changes.

## 2. Field mapping — our columns → their payloads

### 2.1 create-category  (Required: name, categoryCode)
| Their field | Ours |
|---|---|
| name | component group name / stores category name |
| categoryCode | SFI code (spares) / `STORES-{category}` slug (stores) |
| level, allowChildren | tree depth (spares) / 1 (stores) |
| impaChapter*/Group* (6 fields) | null |

### 2.2 category-mapping  (Required: categoryId)
Parent/child from the component tree. Stores: none needed (flat).

### 2.3 create-product-masters  (Required: productCode, name — MUST BE REAL per Sachin)
| Their field | Ours |
|---|---|
| productCode | **`{vesselCode}-{component_code}`** — vessel-prefixed. Bare component_code risks CROSS-VESSEL collision within our own tenant: codes can repeat between vessels (1 proven overlap across two real vessels; in-fleet frequency OPEN, Nilesh query in §7), and on collision their API's duplicate answer + our §4 tolerance would SILENTLY attach vessel 2's parts to vessel 1's master with the wrong maker. The prefix makes this structurally impossible and mirrors our part codes' existing vessel prefix. |
| name | components.name |
| make / model / serialNumber | maker / model / serial_no |
| categoryId/Name | from 2.1 response (get-all-categories resolves on re-run) |
| impaCode | null (spares) / stores impa_code where the master is one item's category — see build note |
| issaCode, hsnCode, partNumber, year | null |
| slug / searchKeywords | derived from name |

### 2.4 create-spare-part  (Required: skuCode, skuName)
| Their field | Ours (spares) | Ours (stores) |
|---|---|---|
| skuCode | part_code | item_code |
| skuName | part_name | item_name |
| skuDescription | specification + note (free text) | specification |
| partNumber | part_number | — |
| make / model | maker / model (fallback: component's) | — |
| manufacturerName | maker (real text) | supplier |
| unitOfMeasurementName | uom text | uom text |
| baseMrp / averagePrice | unit_cost / null | unit_cost / null |
| productSpecifications | `{}` (see Sachin §3) | `{}` |
| year, serialNumber, countryOfOrigin, packSize, featuredImage | null | null |
| **brandId / manufacturerId / unitOfMeasurementId / packTypeId** | **HARDCODED — Sachin §3** | same |

### 2.5 add-spare-part-in-company-catalogue
| Their field | Ours |
|---|---|
| skuCode / productId / categoryId / productMasterSKU | from the chain above |
| smcId / smcName / smcTenantId | tenant constants (env/config) |
| vesselId / vesselName | `shipskart_vessel_links` (already held) |
| type | 'ProductMaster' |
| status / isLocked | 1 / false |
| productSpecifications | `""` blank string (Sachin §3) |

**Our data with nowhere to go (accepted, recorded):** rob/min/max/locations (stock —
stays in PMS; catalogue is identity only), supplier history, lead_time, criticality,
position/drawing numbers, IHM fields.

## 3. Sachin's clarifications (email 2026-08-04) — recorded verbatim in effect

1. **Reference IDs**: brandId/uomId/packTypeId etc. are currently mandatory; *"I've
   added sample guid & name (N/A) in sample request, push the same hardcoded value
   (which we're not using in spare case). You just need to ensure product master id &
   name should be appropriate. We'll remove mandatory fields validation."*
   → Hardcodes (from his own collection): brandId `0ae2195e-c619-4264-a1de-b427c7db4ae2`
   /"N/A" · unitOfMeasurementId `38243d79-af02-4efd-89bb-83d45ca59997`/"N/A" ·
   packTypeId null · manufacturerId `903017a4-9e70-4582-bed5-671c2a43cb38` with OUR
   maker text in manufacturerName. Kept in config, not scattered in code, so his later
   validation removal is a config delete.
2. **productSpecifications**: *"Pass as blank string in add-spare-part-in-company-
   catalogue. If you've any custom attributes like Diameter, Length etc. pass in json
   format else keep blank object in create-spare-part."* → we send `{}` in
   create-spare-part (our specification is free text → goes to skuDescription) and `""`
   in catalogue-add.
3. Endpoints already ENABLED for our key (proven by probe 2026-08-04: four answered
   field-validation 400s, catalogue-add 201).

## 4. Identity & re-runs — the mig-149 pattern

- **Migration 152**: `shipskart_catalogue_links` (NO_SYNC, shore-only, raw-SQL repo,
  absent from schema.ts like the other Shipskart tables):
  `(id, entity_type category|product|sku|catalogue, local_key, vessel_id nullable,
  remote_code, remote_id nullable, push_status pending|pushed|failed, last_error,
  pushed_at, created_at, updated_at)` — UNIQUE (entity_type, local_key, vessel_id).
- Re-run = scan links, skip `pushed`, push the rest. **New spares added later in PMS
  are picked up by the same re-run** (rows without a link = pending) — incremental sync
  is just re-running the pusher.
- Duplicate answers from their side (`already exists` / `already in use`) → mark
  `pushed` (their catalogue is ours alone, so an existing code IS our earlier push).
  Category/product ids recoverable via get-all-categories / get-all-product-masters;
  SKU needs no id downstream (catalogue-add keys on skuCode + productId).

## 5. Build stages

| Stage | Content |
|---|---|
| A | Mig 152 + `shipskartCatalogueLinkRepository` (raw SQL, idempotent, re-run twice clean) |
| B | **Mapper** — pure functions our-rows → their-payloads (spares + stores), unit-testable without network; hardcoded reference IDs from config |
| C | **Pusher service** — per vessel, sequential: categories → mappings → product masters → SKUs → catalogue adds; ~1–2 calls/sec; per-item link updates; duplicate-tolerant; resumable mid-run; loud logging |
| D | Console endpoints (shore-only, Sail Admin): `POST /shipskart/catalogue/push` {vesselId}, `GET /shipskart/catalogue/status` (per-vessel counts by entity/status + last errors) |
| E | **UAT proof**: pilot vessel's real data (1,115 spares + 10 stores, 43 components, ~component groups) pushed end-to-end; verify counts via their get-all-categories/get-all-product-masters; re-run = 0 new pushes |
| F | Report with call counts, duration, failures; then production rollout plan per vessel |

No sync surface, no schema.ts change, no client PUT needed (all five endpoints are
POST). tsc 291 held; commit per stage, push on approval.

## 6. Scale (pilot-proven sample; production counts via Nilesh when scheduling rollout)

Pilot vessel: ~50 categories + 43 masters + 1,125 SKUs + 1,125 catalogue adds ≈ **2,350
calls ≈ 20–40 min/vessel at 1–2 calls/sec**. Production: 4 vessels, run per vessel.

## 7. Open (non-blocking)

- Sahil: final client scope (spares only vs both) — Jeevan recommends both; build
  covers both, stores can be toggled off at push time.
- Sachin (later): removal of mandatory reference-field validation; UAT junk cleanup.
- Stores product-master grouping (§1 note) — reviewable at Stage B with zero waste.
- Informational (does not change the design): how often do component codes repeat across
  the SAME fleet's vessels in production? Read-only for Nilesh:
  `SELECT component_code, count(DISTINCT vessel_id) v FROM components
   WHERE is_deleted=false GROUP BY 1 HAVING count(DISTINCT vessel_id)>1
   ORDER BY v DESC LIMIT 20;`
  The vessel-prefixed productCode (§2.3) is safe either way.
