/**
 * Stage 3C — the catalogue PUSHER (docs/SHIPSKART-CATALOGUE-STAGE3-PLAN.md §5C).
 *
 * Per vessel, sequential, resumable: categories → category mappings → product masters
 * → SKUs → vessel-catalogue adds. Every entity goes through the mig-152 ledger
 * (ensurePending → markPushed/markFailed), so a RE-RUN IS THE INCREMENTAL SYNC:
 * pushed entities are skipped, failures retry, new PMS rows get pushed.
 *
 * Implements the mapper's collision contracts (shipskartCatalogueMapper.ts header):
 *  - product masters: vessel-prefixed productCode — collisions structurally impossible
 *  - categories: tenant-shared; on duplicate, id is resolved by code via
 *    get-all-categories AND the name compared — mismatch = loud NAME-MISMATCH warning
 *    recorded on the link (status still 'pushed'; misclassification is cosmetic,
 *    silence is not allowed)
 *  - SKUs: ledger guard — same skuCode under a DIFFERENT vessel → markFailed for a
 *    human, never 'pushed'. Their duplicate answer without a cross-vessel hit is our
 *    own earlier push → 'pushed'.
 *
 * SHORE ONLY (the b2b credentials live shore-side), single-flight per vessel, paced at
 * ~2 calls/sec. dryRun computes and counts without network or ledger writes; limitSkus
 * caps the SKU/catalogue phases for smoke tests.
 */
import { getPool } from '../../../db';
import { authorizedB2bRequest } from './shipskartTokenService';
import { getB2bConfig } from './shipskartB2bClient';
import { isShipInstance } from '../../sync/syncRole';
import * as links from '../repositories/shipskartCatalogueLinkRepository';
import * as map from './shipskartCatalogueMapper';

const PACE_MS = 500;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const inFlight = new Set<string>();

export interface PhaseCounts { pushed: number; skipped: number; failed: number; }
export interface CataloguePushResult {
  vesselId: string;
  dryRun: boolean;
  categories: PhaseCounts; mappings: PhaseCounts; products: PhaseCounts;
  skus: PhaseCounts; catalogue: PhaseCounts;
  warnings: string[];
  errors: string[];
}

const zero = (): PhaseCounts => ({ pushed: 0, skipped: 0, failed: 0 });
const isDuplicateAnswer = (status: number, body: any) =>
  status === 400 && /already (exists|in use)/i.test(JSON.stringify(body ?? ''));

async function fetchAllPaged(path: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; ; page++) {
    const r = await authorizedB2bRequest('GET', `${path}?pageNumber=${page}&pageSize=100`);
    if (!r.ok || !Array.isArray(r.json?.items)) break;
    all.push(...r.json.items);
    if (page >= Number(r.json.totalPages ?? 1)) break;
  }
  return all;
}

export async function pushVesselCatalogue(
  vesselId: string,
  opts: { includeStores?: boolean; dryRun?: boolean; limitSkus?: number } = {},
): Promise<CataloguePushResult> {
  const includeStores = opts.includeStores !== false;
  const dryRun = opts.dryRun === true;
  const res: CataloguePushResult = {
    vesselId, dryRun,
    categories: zero(), mappings: zero(), products: zero(), skus: zero(), catalogue: zero(),
    warnings: [], errors: [],
  };

  if (await isShipInstance()) { res.errors.push('refused: catalogue push is shore-only'); return res; }
  if (inFlight.has(vesselId)) { res.errors.push('a push for this vessel is already running'); return res; }
  inFlight.add(vesselId);
  try {
    const pool = await getPool();
    if (!pool) throw new Error('Database not initialized');

    // ── vessel + their-side identity ──
    const v = (await pool.query(`SELECT vuuid, name, id AS code FROM vessels WHERE vuuid=$1 AND is_deleted=false`, [vesselId])).rows[0];
    if (!v) throw new Error(`Unknown vessel ${vesselId}`);
    const vesselCode: string = v.code || v.name.replace(/\s+/g, '').slice(0, 8).toUpperCase();
    const link = (await pool.query(
      `SELECT shipskart_vessel_id FROM shipskart_vessel_links WHERE vessel_vuuid=$1 AND push_status='pushed'`, [vesselId])).rows[0];
    if (!link) throw new Error(`Vessel ${v.name} has no pushed Shipskart vessel link — push the vessel first (Stage 2 reconciler)`);
    const ref = map.getReferenceIds();

    // ── our data ──
    const comps = (await pool.query(
      `SELECT DISTINCT c.cuuid, c.component_code, c.name, c.maker, c.model, c.serial_no
         FROM components c JOIN spares s ON s.component_id=c.cuuid AND s.is_deleted=false
        WHERE c.vessel_id=$1 AND c.is_deleted=false AND c.component_code IS NOT NULL`, [vesselId])).rows;
    const allComps = (await pool.query(
      `SELECT component_code, name FROM components WHERE vessel_id=$1 AND is_deleted=false AND component_code IS NOT NULL`, [vesselId])).rows;
    const nameByCode = new Map<string, string>(allComps.map((c: any) => [c.component_code, c.name]));
    const spares = (await pool.query(
      `SELECT suuid, component_id, part_code "partCode", part_name "partName", part_number "partNumber",
              maker, model, uom, unit_cost "unitCost", specification, note
         FROM spares WHERE vessel_id=$1 AND is_deleted=false ORDER BY part_code`, [vesselId])).rows;
    const stores = includeStores ? (await pool.query(
      `SELECT id, item_code "itemCode", item_name "itemName", category, specification, uom, supplier, unit_cost "unitCost"
         FROM stores_items WHERE vessel_id=$1 AND deleted IS NOT TRUE ORDER BY item_code`, [vesselId])).rows : [];

    // ── category set from chains (+ stores categories) ──
    interface Cat { code: string; name: string; level: number; parent: string | null; hasChildren: boolean }
    const cats = new Map<string, Cat>();
    for (const c of comps) {
      const chain = map.deriveCodeChain(c.component_code);
      // Category levels = the chain WITHOUT the leaf (the leaf is the product master).
      const catChain = chain.slice(0, -1);
      catChain.forEach((code, i) => {
        if (!cats.has(code)) cats.set(code, {
          code, name: nameByCode.get(code) || code, level: i + 1,
          parent: i > 0 ? catChain[i - 1] : null, hasChildren: true,
        });
      });
    }
    for (const s of stores) {
      const cat = (s.category || 'General').trim();
      const code = `STORES-${cat.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
      if (!cats.has(code)) cats.set(code, { code, name: `Stores — ${cat}`, level: 1, parent: null, hasChildren: false });
    }

    if (dryRun) {
      res.categories.pushed = cats.size;
      res.mappings.pushed = Array.from(cats.values()).filter(c => c.parent).length;
      res.products.pushed = comps.length + new Set(stores.map((s: any) => s.category || 'General')).size;
      res.skus.pushed = spares.length + stores.length;
      res.catalogue.pushed = res.skus.pushed;
      console.log(`[CataloguePush] DRY RUN ${v.name}: cats=${res.categories.pushed} maps=${res.mappings.pushed} products=${res.products.pushed} skus=${res.skus.pushed}`);
      return res;
    }

    // b2b credentials are needed only from here on — dry runs stay credential-free.
    const cfg = getB2bConfig();
    const smc = {
      smcId: process.env.SHIPSKART_B2B_SMC_ID || cfg.tenantId,
      smcName: process.env.SHIPSKART_B2B_SMC_NAME || 'WAH-KWONG',
      smcTenantId: cfg.tenantId,
    };

    // ── remote maps (resolve-by-code for re-runs and duplicate answers) ──
    let remoteCats = new Map<string, any>((await fetchAllPaged('/integration/SAIL/get-all-categories')).map((c: any) => [c.categoryCode, c]));

    // 1. categories (parents before children — level order)
    for (const cat of Array.from(cats.values()).sort((a, b) => a.level - b.level)) {
      const l = await links.ensurePending('category', cat.code, null, cat.code);
      const remote = remoteCats.get(cat.code);
      if (l.pushStatus === 'pushed' && remote) { res.categories.skipped++; continue; }
      if (remote) {
        // Exists on their side (created earlier or by another vessel's run) — the shared-by-design case.
        if (String(remote.name).trim() !== cat.name.trim()) {
          const w = `NAME-MISMATCH category ${cat.code}: ours='${cat.name}' theirs='${remote.name}' — shared category kept, review classification`;
          res.warnings.push(w); console.warn(`[CataloguePush] ⚠️ ${w}`);
          await links.markPushedWithWarning(l.id, remote.id, w); // status pushed, warning kept
        } else {
          await links.markPushed(l.id, remote.id);
        }
        res.categories.skipped++; continue;
      }
      const r = await authorizedB2bRequest('POST', '/integration/SAIL/create-category',
        { body: map.buildCategoryPayload({ name: cat.name, categoryCode: cat.code, level: cat.level, hasChildren: cat.hasChildren }) });
      await sleep(PACE_MS);
      if (r.ok) { await links.markPushed(l.id, r.json?.id ?? null); res.categories.pushed++; }
      else if (isDuplicateAnswer(r.status, r.json)) { await links.markPushed(l.id); res.categories.pushed++; }
      else { await links.markFailed(l.id, `${r.status} ${JSON.stringify(r.json ?? r.text)}`); res.categories.failed++; res.errors.push(`category ${cat.code}: ${r.status}`); }
    }
    // refresh ids once after creations
    remoteCats = new Map((await fetchAllPaged('/integration/SAIL/get-all-categories')).map((c: any) => [c.categoryCode, c]));

    // 2. category mappings (parent → child)
    for (const cat of Array.from(cats.values()).filter(c => c.parent)) {
      const l = await links.ensurePending('category', `MAP:${cat.code}`, null, cat.code);
      if (l.pushStatus === 'pushed') { res.mappings.skipped++; continue; }
      const child = remoteCats.get(cat.code), parent = remoteCats.get(cat.parent!);
      if (!child || !parent) { await links.markFailed(l.id, 'category id unresolved'); res.mappings.failed++; continue; }
      const r = await authorizedB2bRequest('POST', '/integration/SAIL/category-mapping', {
        body: map.buildCategoryMappingPayload({
          categoryId: child.id, categoryName: child.name, parentCategoryId: parent.id, parentCategoryName: parent.name,
        }),
      });
      await sleep(PACE_MS);
      if (r.ok || isDuplicateAnswer(r.status, r.json)) { await links.markPushed(l.id); res.mappings.pushed++; }
      else { await links.markFailed(l.id, `${r.status} ${JSON.stringify(r.json ?? r.text)}`); res.mappings.failed++; }
    }

    // 3. product masters (components + one synthetic per stores category)
    interface ProductRef { productId: string; productName: string; productCode: string; categoryId: string; categoryName: string }
    const productByLocal = new Map<string, ProductRef>(); // component cuuid | STORES:<cat> → ref
    let remoteProds = new Map<string, any>((await fetchAllPaged('/integration/SAIL/get-all-product-masters')).map((p: any) => [p.productCode, p]));

    const productSpecs: Array<{ localKey: string; code: string; payload: any; catCode: string }> = [];
    for (const c of comps) {
      const chain = map.deriveCodeChain(c.component_code);
      const catCode = chain.length > 1 ? chain[chain.length - 2] : chain[0];
      const rc = remoteCats.get(catCode);
      if (!rc) { res.products.failed++; res.errors.push(`product ${c.component_code}: category ${catCode} unresolved`); continue; }
      productSpecs.push({
        localKey: c.cuuid, code: map.sanitizeCode(`${vesselCode}-${c.component_code}`), catCode,
        payload: map.buildProductMasterPayload({
          vesselCode, component: { componentCode: c.component_code, name: c.name, maker: c.maker, model: c.model, serialNo: c.serial_no },
          categoryId: rc.id, categoryName: rc.name,
        }),
      });
    }
    for (const cat of Array.from(new Set(stores.map((s: any) => (s.category || 'General').trim())))) {
      const code = `STORES-${String(cat).toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
      const rc = remoteCats.get(code);
      if (!rc) { res.products.failed++; res.errors.push(`stores product for ${cat}: category unresolved`); continue; }
      productSpecs.push({
        localKey: `STORES:${cat}`, code: map.sanitizeCode(`${vesselCode}-${code}`), catCode: code,
        payload: map.buildProductMasterPayload({
          vesselCode, component: { componentCode: code, name: `Stores — ${cat}` },
          categoryId: rc.id, categoryName: rc.name,
        }),
      });
    }

    for (const spec of productSpecs) {
      const l = await links.ensurePending('product', spec.localKey, vesselId, spec.code);
      const remote = remoteProds.get(spec.code);
      if ((l.pushStatus === 'pushed' || remote) && remote) {
        await links.markPushed(l.id, remote.id);
        productByLocal.set(spec.localKey, { productId: remote.id, productName: remote.name, productCode: spec.code, categoryId: remote.categoryId ?? spec.payload.data.categoryId, categoryName: remote.categoryName ?? spec.payload.data.categoryName });
        res.products.skipped++; continue;
      }
      const r = await authorizedB2bRequest('POST', '/integration/SAIL/create-product-masters', { body: spec.payload });
      await sleep(PACE_MS);
      if (r.ok || isDuplicateAnswer(r.status, r.json)) { await links.markPushed(l.id, r.json?.id ?? null); res.products.pushed++; }
      else { await links.markFailed(l.id, `${r.status} ${JSON.stringify(r.json ?? r.text)}`); res.products.failed++; res.errors.push(`product ${spec.code}: ${r.status}`); }
    }
    remoteProds = new Map((await fetchAllPaged('/integration/SAIL/get-all-product-masters')).map((p: any) => [p.productCode, p]));
    for (const spec of productSpecs) {
      const remote = remoteProds.get(spec.code);
      if (remote && !productByLocal.has(spec.localKey)) {
        productByLocal.set(spec.localKey, { productId: remote.id, productName: remote.name, productCode: spec.code, categoryId: remote.categoryId ?? spec.payload.data.categoryId, categoryName: remote.categoryName ?? spec.payload.data.categoryName });
      }
    }

    // 4 + 5. SKUs and catalogue adds
    const skuJobs: Array<{ localKey: string; skuCode: string; skuName: string; make?: string; model?: string; productKey: string; buildSku: () => any }> = [
      ...spares.map((s: any) => ({
        localKey: s.suuid, skuCode: map.sanitizeCode(s.partCode), skuName: s.partName, make: s.maker, model: s.model,
        productKey: s.component_id,
        buildSku: () => {
          const pr = productByLocal.get(s.component_id)!;
          return map.buildSkuFromSpare(s, { productId: pr.productId, productName: pr.productName }, { categoryId: pr.categoryId, categoryName: pr.categoryName }, ref);
        },
      })),
      ...stores.map((s: any) => ({
        localKey: `STORE:${s.id}`, skuCode: map.sanitizeCode(s.itemCode), skuName: s.itemName, make: undefined, model: undefined,
        productKey: `STORES:${(s.category || 'General').trim()}`,
        buildSku: () => {
          const pr = productByLocal.get(`STORES:${(s.category || 'General').trim()}`)!;
          return map.buildSkuFromStoreItem(s, { productId: pr.productId, productName: pr.productName }, { categoryId: pr.categoryId, categoryName: pr.categoryName }, ref);
        },
      })),
    ].slice(0, opts.limitSkus ?? Number.MAX_SAFE_INTEGER);

    // SANITIZE-COLLISION GUARD (2026-08-04): two DIFFERENT raw codes can sanitize to the
    // same string (e.g. 'A.B' vs 'A-B'). Zero such pairs exist on the pilot (1,125 codes
    // audited), but production data is unaudited — and without this, the second one would
    // ride their "already in use" answer into 'pushed', silently attached to the first's
    // SKU. Same-vessel collisions fail loudly here; cross-vessel ones fail via the ledger.
    const sanitizedSeen = new Map<string, string>();

    for (const job of skuJobs) {
      const pr = productByLocal.get(job.productKey);
      if (!pr) { res.skus.failed++; res.errors.push(`sku ${job.skuCode}: product unresolved`); continue; }

      // SKU phase
      const sl = await links.ensurePending('sku', job.localKey, vesselId, job.skuCode);
      const firstHolder = sanitizedSeen.get(job.skuCode);
      if (firstHolder && firstHolder !== job.localKey) {
        await links.markFailed(sl.id, `SANITIZE COLLISION: code '${job.skuCode}' also produced by ${firstHolder} in this vessel — needs human decision`);
        res.skus.failed++; res.errors.push(`sku ${job.skuCode}: same-vessel sanitize collision`);
        continue;
      }
      sanitizedSeen.set(job.skuCode, job.localKey);
      if (sl.pushStatus !== 'pushed') {
        // COLLISION GUARD (mapper contract): same code under another vessel → human, never silent.
        const clash = await links.findSkuCodeOtherVessel(job.skuCode, vesselId);
        if (clash) {
          await links.markFailed(sl.id, `SKU CODE COLLISION: '${job.skuCode}' already pushed for vessel ${clash.vesselId} — needs human decision`);
          res.skus.failed++; res.errors.push(`sku ${job.skuCode}: cross-vessel collision`);
          continue;
        }
        const r = await authorizedB2bRequest('POST', '/integration/SAIL/create-spare-part', { body: job.buildSku() });
        await sleep(PACE_MS);
        if (r.ok || isDuplicateAnswer(r.status, r.json)) { await links.markPushed(sl.id, r.json?.id ?? null); res.skus.pushed++; }
        else { await links.markFailed(sl.id, `${r.status} ${JSON.stringify(r.json ?? r.text)}`); res.skus.failed++; res.errors.push(`sku ${job.skuCode}: ${r.status}`); continue; }
      } else res.skus.skipped++;

      // catalogue-add phase
      const cl = await links.ensurePending('catalogue', job.localKey, vesselId, job.skuCode);
      if (cl.pushStatus === 'pushed') { res.catalogue.skipped++; continue; }
      const addBody = map.buildCatalogueAddPayload({
        skuCode: job.skuCode, skuName: job.skuName,
        productId: pr.productId, productMasterCode: pr.productCode, categoryId: pr.categoryId,
        smc, vessel: { vesselId: link.shipskart_vessel_id, vesselName: v.name },
        make: job.make ?? null, model: job.model ?? null,
      });
      const r2 = await authorizedB2bRequest('POST', '/integration/SAIL/add-spare-part-in-company-catalogue', { body: addBody });
      await sleep(PACE_MS);
      if (r2.ok || isDuplicateAnswer(r2.status, r2.json)) { await links.markPushed(cl.id); res.catalogue.pushed++; }
      else { await links.markFailed(cl.id, `${r2.status} ${JSON.stringify(r2.json ?? r2.text)}`); res.catalogue.failed++; res.errors.push(`catalogue ${job.skuCode}: ${r2.status}`); }
    }

    console.log(`[CataloguePush] ${v.name}: cats +${res.categories.pushed}/~${res.categories.skipped} maps +${res.mappings.pushed} products +${res.products.pushed}/~${res.products.skipped} skus +${res.skus.pushed}/~${res.skus.skipped}/x${res.skus.failed} catalogue +${res.catalogue.pushed} warnings=${res.warnings.length}`);
    return res;
  } catch (err: any) {
    res.errors.push(String(err?.message || err));
    console.error(`[CataloguePush] FAILED for ${vesselId}: ${err?.message || err}`);
    return res;
  } finally {
    inFlight.delete(vesselId);
  }
}
