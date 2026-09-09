/**
 * Phase 5 — Shore Maintenance Orchestrator.
 *
 * Replaces the three independent shore schedulers (pmsAlertEngine, syncPruning,
 * syncHealth) with one orchestrator that, on each task's tick:
 *   - single-tenant (MASTER_DATABASE_URL unset, incl. every ship): runs the task
 *     ONCE with NO tenant context — getDb()/getPool() resolve the legacy pool,
 *     exactly as today (jitter 0, concurrency 1, same intervals + boot delay).
 *   - multi-tenant: loops getActiveTenants() and runs the task once per tenant DB
 *     inside runInTenantContext, with bounded concurrency, per-(task,tenant)
 *     re-entrancy guards, jitter, and a per-run timeout.
 *
 * The ship-only schedulers (jobDueScanner, syncAutoScheduler) are NOT touched.
 * The underlying compute functions are unchanged — this only drives them.
 */
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { pmsAlertEngine } from "../modules/alerts/services/pmsAlertEngine";
import { runPruning } from "../modules/sync/pruningService";
import { runHealthCheck } from "../modules/sync/healthMonitor";
import { runDriftScan } from "../modules/sync/driftDetector";

// Parse an int env var honoring an explicit 0 (a plain `|| default` treats "0" as
// unset — wrong for jitter, where 0 = "no jitter").
function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

const BOOT_DELAY_MS = 30_000; // match the schedulers' prior 30s deferred first run
const CONCURRENCY = Math.max(1, envInt("MAINT_TENANT_CONCURRENCY", 4));
const JITTER_MS = Math.max(0, envInt("MAINT_JITTER_MS", 5_000)); // 0..JITTER per tenant (0 = disabled)
const TIMEOUT_ALERTS_MS = envInt("MAINT_ALERTS_TIMEOUT_MS", 4 * 60_000);
const TIMEOUT_HEALTH_MS = envInt("MAINT_HEALTH_TIMEOUT_MS", 5 * 60_000);
const TIMEOUT_PRUNING_MS = envInt("MAINT_PRUNING_TIMEOUT_MS", 30 * 60_000);
const TIMEOUT_DRIFT_MS = envInt("MAINT_DRIFT_TIMEOUT_MS", 15 * 60_000);

interface MaintTask {
  name: string;
  intervalMs: number;
  timeoutMs: number;
  run: () => Promise<unknown>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MaintenanceOrchestrator {
  private tasks: MaintTask[] = [
    // Interval env-tunable like the sweep's SHORE_WO_SWEEP_INTERVAL_MS (ops ask,
    // 02-Sep-2026: run alerts every 12h → MAINT_ALERTS_INTERVAL_MS=43200000).
    { name: "alerts", intervalMs: Math.max(60_000, envInt("MAINT_ALERTS_INTERVAL_MS", 5 * 60_000)), timeoutMs: TIMEOUT_ALERTS_MS, run: () => pmsAlertEngine.runScan() },
    { name: "health", intervalMs: 6 * 60 * 60_000, timeoutMs: TIMEOUT_HEALTH_MS, run: () => runHealthCheck() },
    { name: "pruning", intervalMs: 24 * 60 * 60_000, timeoutMs: TIMEOUT_PRUNING_MS, run: () => runPruning() },
    // Drift = row value vs its OWN newest field log (local only; ship and shore both).
    // Read-only w.r.t. business data — reports into sync_field_log_failures kind='drift'.
    { name: "drift", intervalMs: 24 * 60 * 60_000, timeoutMs: TIMEOUT_DRIFT_MS, run: () => runDriftScan() },
  ];
  private timers: NodeJS.Timeout[] = [];
  // Per-(task,tenant) in-progress guard — a slow tenant never stacks or blocks others.
  private inProgress = new Map<string, boolean>();
  private started = false;

  start(): void {
    if (this.started) {
      console.log("[Maint] Already started");
      return;
    }
    const mt = tenantConnectionManager.isMultiTenantEnabled;
    console.log(`[Maint] Orchestrator starting (${mt ? "multi-tenant" : "single-tenant"}; concurrency=${CONCURRENCY})`);
    for (const task of this.tasks) {
      this.timers.push(setTimeout(() => { void this.tick(task); }, BOOT_DELAY_MS));
      this.timers.push(setInterval(() => { void this.tick(task); }, task.intervalMs));
    }
    this.started = true;
  }

  stop(): void {
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    this.timers = [];
    this.inProgress.clear();
    this.started = false;
    console.log("[Maint] Orchestrator stopped");
  }

  /** One scheduled tick of a task. */
  private async tick(task: MaintTask): Promise<void> {
    try {
      if (!tenantConnectionManager.isMultiTenantEnabled) {
        // Single-tenant / ship: exactly one iteration, no context — identical to today.
        await this.runOne(task, "__single__", null);
        return;
      }
      const tenants = await tenantConnectionManager.getActiveTenants();
      await this.runWithConcurrency(tenants, CONCURRENCY, async (t) => {
        await sleep(Math.floor(Math.random() * JITTER_MS)); // spread tenant load
        await this.runOne(task, t.tuid, t.tuid);
      });
    } catch (err) {
      console.error(`[Maint] tick(${task.name}) error:`, err);
    }
  }

  /**
   * Run a task for one tenant (or the single DB when tuid is null). Holds a
   * per-(task,tenant) guard until the REAL run completes (no overlap for that
   * tenant); the timeout only frees the concurrency slot + logs (so a slow tenant
   * never blocks others), it does not release the guard early.
   */
  private async runOne(task: MaintTask, key: string, tuid: string | null): Promise<void> {
    const guardKey = `${task.name}:${key}`;
    if (this.inProgress.get(guardKey)) {
      console.log(`[Maint] ${guardKey} still running — skipping (no overlap)`);
      return;
    }
    this.inProgress.set(guardKey, true);
    const real = (tuid
      ? tenantConnectionManager.runInTenantContext(tuid, task.run)
      : Promise.resolve().then(task.run)
    )
      .catch((err) => console.error(`[Maint] ${guardKey} failed:`, err))
      .finally(() => { this.inProgress.delete(guardKey); });
    // Bound how long the orchestrator WAITS (frees the slot for other tenants);
    // the guard above is released only when the real run actually finishes.
    await Promise.race([
      real,
      sleep(task.timeoutMs).then(() => {
        if (this.inProgress.get(guardKey)) {
          console.warn(`[Maint] ${guardKey} exceeded ${task.timeoutMs}ms — slot freed; guard held until completion`);
        }
      }),
    ]);
  }

  private async runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
    if (items.length === 0) return;
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx]);
      }
    });
    await Promise.all(workers);
  }
}

export const maintenanceOrchestrator = new MaintenanceOrchestrator();
