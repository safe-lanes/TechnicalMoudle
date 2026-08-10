/**
 * Shipskart b2b admin endpoints — bootstrap (manual, OTP), status, manual reconcile.
 * Shore-side admin surface; ships never mount anything that talks to Shipskart.
 */
import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/auth';
import * as tokenService from '../services/shipskartTokenService';
import * as reconciler from '../services/shipskartReconcilerService';
import * as b2bRepo from '../repositories/shipskartB2bRepository';
import * as vesselAssignments from '../services/vesselAssignmentService';
import { forwardedUserUuid } from '../services/identityGuard';

/** POST /shipskart/b2b/bootstrap { otp? } — the ~90-day manual step (OTP arrives by email). */
export async function bootstrapHandler(req: Request, res: Response) {
  const otp = typeof req.body?.otp === 'string' ? req.body.otp : undefined;
  const result = await tokenService.bootstrap(otp);
  res.json({ success: true, ...result });
}

/**
 * GET /shipskart/b2b/status — token expiries + link counts + the "needs a human" list.
 * Never returns tokens. This is the admin console's data source.
 */
export async function statusHandler(_req: Request, res: Response) {
  const [token, links, failing] = await Promise.all([
    tokenService.tokenStatus(),
    b2bRepo.linkStatusCounts(),
    b2bRepo.failingRows(100),
  ]);
  res.json({ token, links, failing });
}

/**
 * POST /shipskart/b2b/retry { kind: 'user'|'vessel', id } — clear one stuck row back to
 * pending for the next reconciler pass. Refuses rows that already carry a Shipskart id
 * (re-pushing would duplicate — Shipskart has no update endpoint).
 */
export async function retryHandler(req: Request, res: Response) {
  const kind = req.body?.kind;
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  if ((kind !== 'user' && kind !== 'vessel') || !id) {
    return res.status(400).json({ success: false, message: "body must be { kind: 'user'|'vessel', id: string }" });
  }
  const result = await b2bRepo.resetForRetry(kind, id);
  res.status(result.reset ? 200 : 409).json({ success: result.reset, ...result });
}

/**
 * GET /shipskart/b2b/reconciler-config — the per-tenant automation master switch.
 * PUT with { enabled: boolean } flips it (no restart needed — every scheduler tick and
 * manual reconcile re-reads the flag). Default FALSE: a fresh deploy never pushes until
 * a human consciously enables it (see the 05-Aug duplicate-vessel lesson: enabling
 * against a tenant that already has data from another environment creates duplicates).
 */
export async function getReconcilerConfigHandler(_req: Request, res: Response) {
  const { getB2bConfig } = await import('../services/shipskartB2bClient');
  const cfg = getB2bConfig();
  const row = await b2bRepo.getTenantConfig(cfg.tenantId);
  res.json({ tenantId: cfg.tenantId, reconcilerEnabled: row?.reconcilerEnabled ?? false });
}

export async function putReconcilerConfigHandler(req: AuthenticatedRequest, res: Response) {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'body must be { enabled: boolean }' });
  }
  const { getB2bConfig } = await import('../services/shipskartB2bClient');
  const cfg = getB2bConfig();
  await b2bRepo.setReconcilerEnabled(cfg.tenantId, req.body.enabled);
  console.log(`[Shipskart b2b] reconciler_enabled set to ${req.body.enabled} for tenant ${cfg.tenantId} (by user ${forwardedUserUuid(req, 'reconciler-config') ?? 'unknown'})`);
  res.json({ success: true, tenantId: cfg.tenantId, reconcilerEnabled: req.body.enabled });
}

/**
 * POST /shipskart/b2b/reconcile { limit? } — one bounded manual pass, IN THE BACKGROUND.
 *
 * Answers 202 immediately and the page follows GET /shipskart/b2b/reconcile/status. A pass
 * is paced at 5s per API hit across five categories, so answering synchronously is what gave
 * the vessel-sync button a 504 on 07-Aug — the browser gave up while the server carried on.
 * The single-flight guard lives in runReconciliation, so a manual press can never overlap
 * the hourly scheduler on the same rate-limited API.
 */
export async function reconcileHandler(req: Request, res: Response) {
  const limit = Number.isInteger(req.body?.limit) ? req.body.limit : undefined;
  if (reconciler.isReconcileRunning()) {
    return res.status(409).json({ started: false, message: 'a reconciliation pass is already running' });
  }
  reconciler.runReconciliation({ limit })
    .then(r => console.log(`[Shipskart b2b] background reconcile finished: ran=${r.ran}${r.reason ? ` (${r.reason})` : ''} users=${JSON.stringify(r.users)} mappings=${JSON.stringify(r.mappings)}`))
    .catch(err => console.error('[Shipskart b2b] background reconcile crashed:', err?.message || err));
  res.status(202).json({ started: true, note: 'running in background — follow GET /shipskart/b2b/reconcile/status' });
}

/** GET /shipskart/b2b/reconcile/status — is a pass running, and what did the last one do? */
export async function reconcileStatusHandler(_req: Request, res: Response) {
  res.json({ running: reconciler.isReconcileRunning(), lastRun: reconciler.getLastReconcile() });
}

/**
 * POST /shipskart/vessel-assignments — CAPTURE-AT-LOGIN.
 * Body: the decrypted `myVessels` array (or `{ myVessels: [...] }`).
 * The user uuid comes from the FORWARDED IDENTITY (x-user-id → req.user.userUuid), never
 * from the body, so a caller cannot write another user's assignments.
 */
export async function vesselAssignmentsHandler(req: AuthenticatedRequest, res: Response) {
  // FORWARDED HEADER ONLY — never req.user.userUuid: mock auth substitutes a shared default
  // uuid when the header is absent, and writing assignments under it would merge every
  // un-identified user's vessels into one row set (identityGuard.ts).
  const userUuid = forwardedUserUuid(req, 'vessel-assignments');
  if (!userUuid) {
    return res.status(401).json({ success: false, errorCode: 'NO_FORWARDED_IDENTITY', message: 'No forwarded user identity (x-user-id) — cannot record vessel assignments.' });
  }
  // allowEmpty is opt-in and deliberate: an empty set otherwise no-ops, so a browser that
  // could not decrypt the userProfile can never revoke a user's vessels.
  const allowEmpty = req.body?.allowEmpty === true;
  const result = await vesselAssignments.captureAssignments(userUuid, req.body, { allowEmpty });
  res.json({ success: true, ...result });
}

/**
 * POST /shipskart/catalogue/push — Stage 3D. Body: { vesselId, dryRun?, includeStores?,
 * limitSkus? }. dryRun answers synchronously (counts only, no network). A live push runs
 * in the BACKGROUND (a full vessel is ~25 min at API pace) — the response says started,
 * and progress is read from GET /shipskart/catalogue/status (the mig-152 ledger is the
 * progress record). The service refuses concurrent runs per vessel and refuses on ships.
 */
export async function cataloguePushHandler(req: AuthenticatedRequest, res: Response) {
  const vesselId = req.body?.vesselId;
  if (!vesselId || typeof vesselId !== 'string') {
    return res.status(400).json({ error: 'vesselId is required' });
  }
  const svc = await import('../services/shipskartCataloguePushService');
  const opts = {
    dryRun: req.body?.dryRun === true,
    includeStores: req.body?.includeStores !== false,
    limitSkus: Number.isInteger(req.body?.limitSkus) ? req.body.limitSkus : undefined,
  };
  if (opts.dryRun) {
    return res.json(await svc.pushVesselCatalogue(vesselId, opts));
  }
  svc.pushVesselCatalogue(vesselId, opts)
    .then(r => console.log(`[CataloguePush] background run finished for ${vesselId}: errors=${r.errors.length} warnings=${r.warnings.length}`))
    .catch(err => console.error(`[CataloguePush] background run crashed for ${vesselId}:`, err?.message || err));
  res.status(202).json({ started: true, vesselId, note: 'running in background — follow GET /shipskart/catalogue/status' });
}

/**
 * Admin → Sync Vessels (06-Aug).
 *   POST /shipskart/vessels/sync { preview? } — BOTH the preview and the real run go to the
 *     background and answer 202 at once; the page follows GET /shipskart/vessels/sync/status.
 *     The preview used to answer synchronously, but it is paced at 5s per vessel just like a
 *     run, so on a real fleet it outlived the gateway timeout and the browser got a 504 while
 *     the work continued server-side (dev, 07-Aug). Nothing was lost — a preview writes
 *     nothing — but the page never received its result.
 *   GET  /shipskart/vessels/sync/status — running flag + the last result (rows + totals).
 */
export async function vesselSyncHandler(req: AuthenticatedRequest, res: Response) {
  const svc = await import('../services/shipskartVesselSyncService');
  const preview = req.body?.preview === true;
  if (svc.isVesselSyncRunning()) {
    return res.status(409).json({ started: false, message: 'a vessel sync is already running' });
  }
  svc.runVesselSync({ preview })
    .then(r => console.log(`[VesselSync] background ${preview ? 'preview' : 'run'} finished: ${JSON.stringify(r.totals)} errors=${r.errors.length}`))
    .catch(err => console.error('[VesselSync] background job crashed:', err?.message || err));
  res.status(202).json({ started: true, preview, note: 'running in background — follow GET /shipskart/vessels/sync/status' });
}

export async function vesselSyncStatusHandler(_req: AuthenticatedRequest, res: Response) {
  const svc = await import('../services/shipskartVesselSyncService');
  res.json({ running: svc.isVesselSyncRunning(), lastRun: svc.getLastVesselSync() });
}

/** GET /shipskart/catalogue/status — per-vessel/per-entity ledger counts + recent failures. */
export async function catalogueStatusHandler(_req: AuthenticatedRequest, res: Response) {
  const links = await import('../repositories/shipskartCatalogueLinkRepository');
  res.json({
    summary: await links.statusSummary(),
    recentFailures: await links.recentFailures(20),
  });
}

/** GET /shipskart/catalogue/status/:vesselId — the Admin card's single data source. */
export async function catalogueVesselStatusHandler(req: AuthenticatedRequest, res: Response) {
  const vesselId = req.params.vesselId;
  const links = await import('../repositories/shipskartCatalogueLinkRepository');
  const svc = await import('../services/shipskartCataloguePushService');
  const st = await links.vesselStatus(vesselId);
  const get = (e: string, s: string) => st.counts.find(c => c.entityType === e && c.pushStatus === s)?.n ?? 0;
  const skuTotal = st.totals.spares + st.totals.stores;
  res.json({
    vesselId,
    running: svc.isCataloguePushRunning(vesselId),
    totals: { skus: skuTotal, products: st.totals.components, spares: st.totals.spares, stores: st.totals.stores },
    progress: {
      categories: { pushed: get('category', 'pushed'), failed: get('category', 'failed') },
      products:   { pushed: get('product', 'pushed'),  failed: get('product', 'failed') },
      skus:       { pushed: get('sku', 'pushed'),      failed: get('sku', 'failed'),
                    remaining: Math.max(0, skuTotal - get('sku', 'pushed')) },
      catalogue:  { pushed: get('catalogue', 'pushed'), failed: get('catalogue', 'failed'),
                    remaining: Math.max(0, skuTotal - get('catalogue', 'pushed')) },
    },
    failures: st.failures,
    // Run-level outcome (vessel-not-linked / listing abort / crash) — these never reach
    // the per-item ledger, so without this the card shows 0% with no reason.
    lastRun: svc.getLastRunInfo(vesselId),
  });
}
