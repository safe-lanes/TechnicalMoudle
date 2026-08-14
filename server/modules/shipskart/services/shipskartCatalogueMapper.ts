/**
 * Stage 3B — PURE mapper: our rows → Shipskart's five catalogue payloads
 * (docs/SHIPSKART-CATALOGUE-STAGE3-PLAN.md §2). No network, no DB — unit-testable.
 *
 * ── COLLISION SAFETY, PER ENTITY (explicit; the vessel prefix does NOT fix everything) ──
 *
 *  PRODUCT MASTERS — SAFE BY CONSTRUCTION. productCode = `{vesselCode}-{component_code}`
 *  (plan §2.3): component codes proven to repeat across vessels (1 real overlap found),
 *  and an unprefixed collision would silently attach vessel 2's parts to vessel 1's
 *  master. The prefix makes that impossible.
 *
 *  CATEGORIES — SHARED ACROSS VESSELS BY DESIGN (tenant-level; prefixing would fragment
 *  the crew's browse tree per vessel). Duplicate answer therefore normally means "the
 *  other vessel already created this category" — CORRECT sharing. Residual risk: same
 *  code with a DIFFERENT name across fleets (schemes differ — proven: Gas Mia 9-digit vs
 *  pilot dotted — so overlap is rare but real: 1 case found). CONTRACT FOR THE PUSHER
 *  (Stage C): on duplicate, resolve the id via get-all-categories by code AND compare
 *  names; mismatch → status stays 'pushed' but the link records a loud NAME-MISMATCH
 *  warning. Misclassification is cosmetic; silent it must not be.
 *
 *  SKUs — NOT SAFE BY STRUCTURE. skuCode = our part_code/item_code, and part_code is
 *  user-enterable: 1,113/1,115 pilot rows carry the vessel prefix but 2 do not — so
 *  cross-vessel collision is possible. CONTRACT FOR THE PUSHER: before pushing a SKU,
 *  check the ledger for the same skuCode under a DIFFERENT vessel; if found → mark
 *  FAILED with a clear error (human decides), never 'pushed'. This local check is
 *  complete because we are the tenant catalogue's only writer. A duplicate answer from
 *  their side WITHOUT a cross-vessel ledger hit is our own earlier push → 'pushed'.
 *
 *  CATALOGUE ADDS — keyed (skuCode, vesselId), per-vessel by nature; safe given the SKU
 *  guard above.
 *
 * Reference IDs are Sachin's hardcodes (email 2026-08-04): pushed verbatim, unused on
 * their side for spares; env-overridable so his later validation removal is config-only.
 */

export interface CatalogueRefIds {
  brandId: string; brandName: string;
  manufacturerId: string;                    // GUID hardcoded; manufacturerName carries OUR maker text
  unitOfMeasurementId: string; unitOfMeasurementName: string;
  packTypeId: string | null; packTypeName: string | null;
}

export function getReferenceIds(): CatalogueRefIds {
  return {
    brandId: process.env.SHIPSKART_REF_BRAND_ID || '0ae2195e-c619-4264-a1de-b427c7db4ae2',
    brandName: process.env.SHIPSKART_REF_BRAND_NAME || 'N/A',
    manufacturerId: process.env.SHIPSKART_REF_MANUFACTURER_ID || '903017a4-9e70-4582-bed5-671c2a43cb38',
    unitOfMeasurementId: process.env.SHIPSKART_REF_UOM_ID || '38243d79-af02-4efd-89bb-83d45ca59997',
    unitOfMeasurementName: process.env.SHIPSKART_REF_UOM_NAME || 'N/A',
    packTypeId: null,
    packTypeName: null,
  };
}

/**
 * Their productCode/skuCode charset: uppercase letters, numbers, hyphens, underscores
 * (rejected live: "Product code can only contain uppercase letters, numbers, hyphens,
 * and underscores" — our dotted SFI codes violated it; category codes are NOT
 * restricted, proven by 38 dotted categories accepted). Dots and other chars → '-'.
 */
export const sanitizeCode = (s: string) => String(s || '').toUpperCase().trim()
  .replace(/[^A-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const slugify = (s: string) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/**
 * Display name convention (Rev01 mapping, Jeevan 14-Aug): categories and product
 * masters show "{component_code} - {component_name}" so the crew sees the code they
 * know from PMS. Descriptions stay the PLAIN name (also Rev01).
 */
export const codedName = (code: string, name: string | null | undefined) =>
  name ? `${code} - ${name}` : code;

/** Year for the product master — extracted from installation_date text (Rev01: last
 *  4 chars in practice; a 4-digit-year regex is tolerant of date format drift). */
export const yearFromInstallationDate = (v: any): string | null => {
  const m = /(\d{4})(?!.*\d{4})/.exec(String(v ?? ''));
  return m ? m[1] : null;
};

/**
 * Ancestor chain for a component code, derived from the codes present in OUR components
 * table (the tree ships inside the table — 35 roots on the pilot, parents verified
 * present). Two numbering schemes handled:
 *   dotted  '652.020.03' → ['652', '652.020', '652.020.03']
 *   fixed-3 '434001001'  → ['434', '434001', '434001001']   (Gas Mia style)
 * Heuristic is verified against real rows in the Stage B harness; unknown shapes fall
 * back to the code itself (single-level category).
 */
export function deriveCodeChain(componentCode: string): string[] {
  const code = String(componentCode || '').trim();
  if (!code) return [];
  if (code.includes('.')) {
    const parts = code.split('.');
    return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
  }
  if (/^\d{6,}$/.test(code)) {
    const chain: string[] = [];
    for (let len = 3; len < code.length; len += 3) chain.push(code.slice(0, len));
    chain.push(code);
    return chain;
  }
  return [code];
}

// ── payload builders ─────────────────────────────────────────────────────────

export function buildCategoryPayload(opts: { name: string; categoryCode: string; level: number; hasChildren: boolean; description?: string }) {
  return {
    data: {
      name: opts.name,
      categoryCode: opts.categoryCode,
      allowChildren: opts.hasChildren,
      status: 1,
      // Rev01: description is the PLAIN name (no code prefix) even when `name` is coded.
      description: opts.description ?? opts.name,
      impaChapterId: null, impaChapterName: null,
      impaGroupId: null, impaGroupName: null,
      impaSubGroupId: null, impaSubGroupName: null,
      level: opts.level,
      path: null,
      isActive: true,
    },
  };
}

export function buildCategoryMappingPayload(opts: {
  categoryId: string; categoryName: string; parentCategoryId: string; parentCategoryName: string;
}) {
  return {
    data: {
      categoryId: opts.categoryId, categoryName: opts.categoryName,
      parentCategoryId: opts.parentCategoryId, parentCategoryName: opts.parentCategoryName,
      isActive: true,
    },
  };
}

export function buildProductMasterPayload(opts: {
  vesselCode: string;
  component: { componentCode: string; name: string; maker?: string | null; model?: string | null; serialNo?: string | null; installationDate?: any };
  categoryId: string; categoryName: string;
  /** 'coded' (default, Rev01: "{code} - {name}") | 'plain' (stores synthetic masters keep their readable name). */
  nameStyle?: 'coded' | 'plain';
}) {
  const c = opts.component;
  const displayName = (opts.nameStyle ?? 'coded') === 'coded' ? codedName(c.componentCode, c.name) : c.name;
  return {
    data: {
      productCode: sanitizeCode(`${opts.vesselCode}-${c.componentCode}`), // COLLISION SAFETY: see header; charset per their validation
      name: displayName,
      categoryId: opts.categoryId,
      categoryName: opts.categoryName,
      description: c.name,                  // Rev01: plain name only, no code prefix
      status: 'Active',
      impaCode: null, issaCode: null, hsnCode: null, featuredImage: null,
      slug: slugify(`${opts.vesselCode}-${c.name}`),
      isActive: true,
      searchKeywords: slugify(c.name),
      make: c.maker ?? null,                // Rev01 (Jeevan's correction): the COMPONENT's maker
      model: c.model ?? null,
      serialNumber: c.serialNo ?? null,
      year: yearFromInstallationDate(c.installationDate),  // Rev01: from installation_date
      partNumber: null,
    },
  };
}

interface SkuSource {
  skuCode: string; skuName: string; description?: string | null;
  partNumber?: string | null; make?: string | null; model?: string | null;
  manufacturerName?: string | null; uomName?: string | null; unitCost?: number | null;
  /** Rev01: name/value pairs for their productSpecifications object (blank values omitted by the caller). */
  specs?: Record<string, string> | null;
}

function buildSkuPayload(src: SkuSource, product: { productId: string; productName: string },
  category: { categoryId: string; categoryName: string }, ref: CatalogueRefIds) {
  return {
    data: {
      categoryId: category.categoryId, categoryName: category.categoryName,
      productId: product.productId, productName: product.productName,
      skuCode: sanitizeCode(src.skuCode),   // COLLISION SAFETY: pusher ledger-guards cross-vessel reuse; charset per their validation
      skuName: src.skuName,
      skuDescription: src.description || src.skuName,
      status: 1,
      brandId: ref.brandId, brandName: ref.brandName,
      manufacturerId: ref.manufacturerId,
      manufacturerName: src.manufacturerName || 'N/A',
      partNumber: src.partNumber ?? null,
      make: src.make ?? null, model: src.model ?? null,
      modelNumber: null, year: null, serialNumber: null,
      baseMrp: src.unitCost ?? null, averagePrice: null,
      featuredImage: null, isActive: true,
      packTypeId: ref.packTypeId, packTypeName: ref.packTypeName, packSize: null,
      unitOfMeasurementId: ref.unitOfMeasurementId,
      unitOfMeasurementName: src.uomName || ref.unitOfMeasurementName,
      countryId: null, countryOfOrigin: null,
      // Rev01: real spec pairs when the caller has them (their Postman sample shows an
      // object of name/value strings); {} otherwise. Free text still lives in skuDescription.
      productSpecifications: src.specs && Object.keys(src.specs).length ? src.specs : {},
    },
  };
}

export function buildSkuFromSpare(spare: any, product: { productId: string; productName: string },
  category: { categoryId: string; categoryName: string }, ref: CatalogueRefIds) {
  return buildSkuPayload({
    skuCode: spare.partCode, skuName: spare.partName,
    description: [spare.specification, spare.note].filter(Boolean).join(' | ') || null,
    partNumber: spare.partNumber,
    make: spare.maker,                       // Rev01 (Jeevan's correction): the SPARE's maker
    model: spare.partNumber ?? null,         // Rev01: part number doubles as the model field
    manufacturerName: spare.maker, uomName: spare.uom,
    unitCost: 0,                             // Rev01: baseMrp always 0 for spares (stores keep unit_cost)
    specs: {
      ...(spare.drawingNumber ? { drawingNumber: String(spare.drawingNumber) } : {}),
      ...(spare.positionNumber ? { positionNumber: String(spare.positionNumber) } : {}),
    },
  }, product, category, ref);
}

export function buildSkuFromStoreItem(item: any, product: { productId: string; productName: string },
  category: { categoryId: string; categoryName: string }, ref: CatalogueRefIds) {
  return buildSkuPayload({
    skuCode: item.itemCode, skuName: item.itemName,
    description: item.specification || null,
    manufacturerName: item.supplier, uomName: item.uom,
    unitCost: item.unitCost != null ? Number(item.unitCost) : null,
  }, product, category, ref);
}

export function buildCatalogueAddPayload(opts: {
  skuCode: string; skuName: string;
  productId: string; productMasterCode: string;
  categoryId: string;
  smc: { smcId: string; smcName: string; smcTenantId: string };
  vessel: { vesselId: string; vesselName: string };
  make?: string | null; model?: string | null;
}) {
  return {
    data: {
      skuCode: opts.skuCode,
      productName: opts.skuName,
      smcId: opts.smc.smcId, smcName: opts.smc.smcName, smcTenantId: opts.smc.smcTenantId,
      vesselId: opts.vessel.vesselId, vesselName: opts.vessel.vesselName,
      productId: opts.productId,
      status: 1, isLocked: false,
      type: 'ProductMaster',
      productMasterSKU: opts.productMasterCode,
      categoryId: opts.categoryId,
      make: opts.make ?? null, model: opts.model ?? null,
      productSpecifications: '',            // Sachin §3: blank string here
    },
  };
}
