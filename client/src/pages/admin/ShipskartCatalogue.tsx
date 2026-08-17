/**
 * Shipskart Catalogue Push — Admin page (Stage 3, plan §5D + UI).
 *
 * Lets the DOMAIN TEAM (no dev/support involvement) seed and maintain Shipskart's
 * purchasing catalogue from our spares/stores data, per vessel:
 *   - live progress (parts pushed / remaining / failed) with auto-refresh while running
 *   - Push runs in the BACKGROUND server-side (a full vessel can take hours under
 *     Shipskart's rate limiter; the ledger records every item, so closing this page
 *     changes nothing)
 *   - "Push / Retry" is ONE action by design: the server skips what's already pushed
 *     and retries failures — safe to press any time, never duplicates
 *   - failure log with the exact error per item (rate limits, collisions, etc.)
 *
 * Route: /admin/shipskart-catalogue (shore-only menu item, like Fleet Overview).
 */
import { useContext, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VesselContext } from "@/contexts/VesselContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, RefreshCw, CheckCircle2, AlertTriangle, Loader2, PackageSearch, Zap, Ship, Eye } from "lucide-react";

interface VesselSyncRow {
  vesselId: string; name: string; imo: string | null; outcome: string;
  shipskartVesselId?: string | null; detail?: string | null; mapped?: number; unmapped?: number;
}
interface VesselSyncResult {
  preview: boolean; startedAt: string; finishedAt?: string;
  totals: Record<string, number>; rows: VesselSyncRow[]; errors: string[];
}

interface VesselStatus {
  vesselId: string;
  running: boolean;
  totals: { skus: number; products: number; spares: number; stores: number };
  progress: {
    categories: { pushed: number; failed: number };
    products: { pushed: number; failed: number };
    skus: { pushed: number; failed: number; remaining: number };
    catalogue: { pushed: number; failed: number; remaining: number };
  };
  failures: Array<{ entity_type: string; local_key: string; remote_code: string | null; last_error: string | null; updated_at: string }>;
  /** Pre-flight (17-Aug): this vessel's part codes already pushed for ANOTHER vessel — each will be refused by the collision guard. */
  preflight?: { collisions: number; byOtherVessel: Array<{ vesselId: string; vesselName: string | null; count: number; sample: string[] }> };
  lastRun: { finishedAt: string; ok: boolean; errors: string[]; warnings: string[] } | null;
}

export default function ShipskartCatalogue() {
  const vesselCtx = useContext(VesselContext);
  const vessels = vesselCtx?.vessels ?? [];
  const [vesselId, setVesselId] = useState<string>("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const { toast } = useToast();

  // Automation master switch (per-tenant reconciler_enabled). Turning it ON is guarded by
  // a confirmation dialog — it starts creating this company's vessels/users on Shipskart.
  const reconcilerQuery = useQuery<{ reconcilerEnabled: boolean }>({
    queryKey: ["shipskart-reconciler-config"],
    queryFn: async () => (await apiRequest("GET", "/technical/api/shipskart/b2b/reconciler-config")).json(),
  });
  const reconcilerMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await apiRequest("PUT", "/technical/api/shipskart/b2b/reconciler-config", { enabled })).json(),
    onSuccess: (d: any) => {
      toast({
        title: d?.reconcilerEnabled ? "Automatic push enabled" : "Automatic push disabled",
        description: d?.reconcilerEnabled
          ? "Vessels, users and vessel assignments will now sync to Shipskart automatically (hourly)."
          : "Nothing will be pushed to Shipskart automatically. Existing data stays as it is.",
      });
      queryClient.invalidateQueries({ queryKey: ["shipskart-reconciler-config"] });
    },
    onError: (e: any) => toast({ title: "Could not change the setting", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const statusQuery = useQuery<VesselStatus>({
    queryKey: ["shipskart-catalogue-status", vesselId],
    queryFn: async () => (await apiRequest("GET", `/technical/api/shipskart/catalogue/status/${vesselId}`)).json(),
    enabled: !!vesselId,
    // Poll fast while a push runs; gently otherwise so the page stays current.
    refetchInterval: (q) => (q.state.data?.running ? 5_000 : 30_000),
  });

  const pushMutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/technical/api/shipskart/catalogue/push", { vesselId })).json(),
    onSuccess: (d: any) => {
      if (d?.started) {
        toast({ title: "Push started", description: "Running in the background — progress updates below. Already-pushed items are skipped automatically." });
      } else {
        toast({ title: "Push not started", description: String(d?.errors?.[0] ?? "Unknown response"), variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["shipskart-catalogue-status", vesselId] });
    },
    onError: (e: any) => toast({ title: "Push failed to start", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const s = statusQuery.data;
  const pct = s && s.totals.skus > 0 ? Math.round((s.progress.skus.pushed / s.totals.skus) * 100) : 0;
  const done = !!s && !s.running && s.progress.skus.remaining === 0 && s.progress.skus.failed === 0 && s.totals.skus > 0;
  const hasFailures = !!s && (s.progress.skus.failed > 0 || s.failures.length > 0);
  const notStarted = !!s && s.progress.skus.pushed === 0 && !s.running;

  return (
    <div className="p-6 max-w-5xl space-y-4" data-testid="page-shipskart-catalogue">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-semibold">Shipskart Catalogue</h1>
          <p className="text-sm text-gray-500">Publish this vessel's spares and stores into the Shipskart purchasing catalogue so crew can order against our own parts list.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />Automatic sync to Shipskart</CardTitle>
          <CardDescription>
            When ON, the system keeps Shipskart up to date by itself (hourly): new vessels and users are created,
            role changes and vessel assignments follow automatically. When OFF, nothing is ever pushed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={reconcilerQuery.data?.reconcilerEnabled ?? false}
              disabled={reconcilerQuery.isLoading || reconcilerMutation.isPending}
              onCheckedChange={(next) => (next ? setConfirmEnable(true) : reconcilerMutation.mutate(false))}
              data-testid="switch-reconciler-enabled"
            />
            <span className="text-sm">
              {reconcilerQuery.isLoading ? "Loading…"
                : reconcilerQuery.data?.reconcilerEnabled
                  ? <Badge className="bg-green-600">ON — syncing automatically</Badge>
                  : <Badge variant="secondary">OFF — manual control</Badge>}
            </span>
          </div>
          <ReconcileNowRow enabled={reconcilerQuery.data?.reconcilerEnabled ?? false} />
        </CardContent>
      </Card>

      <VesselSyncCard />

      <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable automatic push to Shipskart?</AlertDialogTitle>
            <AlertDialogDescription>
              From the next hourly run, this will start creating this company's vessels and users on Shipskart
              and keep them in sync. Only enable it if this environment is the one that should own the Shipskart
              data — two environments pushing to the same Shipskart company creates duplicates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => reconcilerMutation.mutate(true)} data-testid="btn-confirm-enable-reconciler">
              Enable automatic sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vessel</CardTitle>
          <CardDescription>Progress is saved per item — pushing again never duplicates, it completes and retries.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={vesselId} onValueChange={setVesselId}>
            <SelectTrigger className="w-72" data-testid="select-catalogue-vessel">
              <SelectValue placeholder="Select a vessel…" />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => pushMutation.mutate()}
            disabled={!vesselId || !!s?.running || pushMutation.isPending}
            data-testid="btn-catalogue-push"
          >
            {s?.running ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Push running…</>)
              : hasFailures ? (<><RefreshCw className="h-4 w-4 mr-2" />Retry failed &amp; continue</>)
              : notStarted ? (<><ShoppingCart className="h-4 w-4 mr-2" />Push to Shipskart</>)
              : (<><RefreshCw className="h-4 w-4 mr-2" />Push updates</>)}
          </Button>
          {s?.running && <Badge variant="secondary" className="animate-pulse">Running in background</Badge>}
          {done && <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />All items in catalogue</Badge>}
        </CardContent>
      </Card>

      {!vesselId ? (
        <Card><CardContent className="py-10 text-center text-gray-500">
          <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Select a vessel to see its catalogue status.
        </CardContent></Card>
      ) : statusQuery.isLoading ? (
        <Card><CardContent className="py-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 mx-auto animate-spin" />
        </CardContent></Card>
      ) : statusQuery.isError ? (
        <Card><CardContent className="py-10 text-center text-red-600">
          Could not load status — {String((statusQuery.error as any)?.message ?? "unknown error")}
        </CardContent></Card>
      ) : s ? (
        <>
          {s.lastRun && !s.lastRun.ok && !s.running && (
            <Card className="border-red-300">
              <CardContent className="py-3">
                <p className="text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  <b>Last push could not run</b> ({new Date(s.lastRun.finishedAt).toLocaleString()}):
                </p>
                <ul className="text-sm text-red-700 mt-1 ml-6 list-disc">
                  {s.lastRun.errors.map((e, i) => <li key={i}>{friendlyError(e)}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Progress</CardTitle>
              <CardDescription>
                {s.totals.spares} spares + {s.totals.stores} stores items = {s.totals.skus} parts, under {s.totals.products} equipment entries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Parts in catalogue</span>
                  <span className="font-medium">{s.progress.skus.pushed} / {s.totals.skus} ({pct}%)</span>
                </div>
                <Progress value={pct} className="h-3" data-testid="progress-catalogue" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <StatBox label="Pushed" value={s.progress.skus.pushed} tone="ok" />
                <StatBox label="Remaining" value={s.progress.skus.remaining} tone="neutral" />
                <StatBox label="Failed (retryable)" value={s.progress.skus.failed} tone={s.progress.skus.failed ? "warn" : "neutral"} />
                <StatBox label="Categories / Equipment" value={`${s.progress.categories.pushed} / ${s.progress.products.pushed}`} tone="neutral" />
              </div>
              {(s.preflight?.collisions ?? 0) > 0 && (
                <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  <b>{s.preflight!.collisions} part code(s) on this vessel are already on Shipskart under a different vessel</b>
                  {' '}({s.preflight!.byOtherVessel.map(o => `${o.vesselName ?? o.vesselId}: ${o.count}, e.g. ${o.sample.join(', ')}`).join('; ')}).
                  Shipskart part codes must be unique across the whole account, so these will be <b>refused</b> — they will not be attached
                  to the other vessel and they will not be pushed here. Usually the two vessels share the same spare data (a copied test
                  vessel). Fix the part codes, or push only the vessel that truly owns them.
                </p>
              )}
              {s.progress.skus.failed > 0 && !s.running && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {s.progress.skus.failed} item(s) did not go through (details below — most commonly Shipskart's rate limit).
                  Press <b>Retry failed &amp; continue</b> — only the missing items are sent.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Failure log</CardTitle>
              <CardDescription>The most recent items that could not be pushed, with the exact reason. Retrying is always safe.</CardDescription>
            </CardHeader>
            <CardContent>
              {s.failures.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No failures — everything sent so far went through cleanly.</p>
              ) : (
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="whitespace-nowrap">When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.failures.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="capitalize">{f.entity_type}</TableCell>
                          <TableCell className="font-mono text-xs">{f.remote_code ?? f.local_key}</TableCell>
                          <TableCell className="text-xs max-w-md truncate" title={f.last_error ?? ""}>
                            {friendlyError(f.last_error)}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(f.updated_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/**
 * Vessels must exist on Shipskart before any user can be mapped to them, and before a
 * catalogue can be pushed. This runs on demand — never on a timer — because the domain team
 * needs to SEE what happened to each vessel. Check first shows what would change without
 * touching anything; Sync then links the vessels and settles the crew mappings that were
 * waiting on them.
 */
/**
 * "Run now" for the hourly reconciler — the sweep that retries failed user enrolments,
 * clears their click-attempt counters and applies outstanding vessel assignments.
 *
 * WHY IT EXISTS: the endpoint has always been there, but with no button the only way to
 * force a pass was curl with signed headers. On 10-Aug that turned a one-click diagnosis
 * into a long back-and-forth with the deployment team, so the button is the fix.
 *
 * BACKGROUND, like the vessel sync: a pass is paced at 5s per API call, so a synchronous
 * request would 504 exactly as the vessel-sync button did on 07-Aug. The POST answers 202
 * and this row polls the status endpoint while it runs.
 */
function ReconcileNowRow({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const statusQuery = useQuery<{ running: boolean; lastRun: any }>({
    queryKey: ["shipskart-reconcile-status"],
    queryFn: async () => (await apiRequest("GET", "/technical/api/shipskart/b2b/reconcile/status")).json(),
    refetchInterval: (q) => (q.state.data?.running ? 3_000 : false),
  });
  const runMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/technical/api/shipskart/b2b/reconcile", {})).json(),
    onSuccess: () => {
      toast({ title: "Sync started", description: "Running in the background — the result appears here when it finishes." });
      queryClient.invalidateQueries({ queryKey: ["shipskart-reconcile-status"] });
    },
    onError: (e: any) => toast({ title: "Could not start", description: String(e?.message ?? e), variant: "destructive" }),
  });

  const running = statusQuery.data?.running ?? false;
  const last = statusQuery.data?.lastRun ?? null;
  const total = (o: Record<string, number> | undefined) =>
    Object.values(o ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          disabled={!enabled || running || runMutation.isPending}
          onClick={() => runMutation.mutate()}
          data-testid="btn-reconcile-now"
        >
          {running ? "Sync running…" : "Sync users now"}
        </Button>
        <span className="text-xs text-gray-500">
          {!enabled
            ? "Turn automatic sync ON to use this — it runs the same job immediately instead of waiting for the next hour."
            : "Retries users whose Purchasing access failed, and applies any vessel changes waiting to go across."}
        </span>
      </div>

      {last && !running && (
        <div className="text-xs text-gray-600" data-testid="text-reconcile-last-run">
          {last.ran === false ? (
            <span className="text-amber-700">Last run did nothing — {last.reason ?? "unknown reason"}</span>
          ) : (
            <>
              Last run {last.finishedAt ? new Date(last.finishedAt).toLocaleString() : ""} —{" "}
              <strong>{total(last.users)}</strong> user(s), <strong>{total(last.mappings)}</strong> vessel assignment(s),{" "}
              <strong>{total(last.vessels)}</strong> vessel(s) processed.
              {total(last.users) + total(last.mappings) + total(last.vessels) === 0 && " Nothing was outstanding."}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VesselSyncCard() {
  const { toast } = useToast();

  // BOTH buttons start a background job and return at once; the result arrives through this
  // poll. The check used to be awaited inline, which meant a fleet-sized check outlived the
  // gateway timeout and the browser saw a 504 (dev, 07-Aug) even though the server finished.
  const statusQuery = useQuery<{ running: boolean; lastRun: VesselSyncResult | null }>({
    queryKey: ["shipskart-vessel-sync-status"],
    queryFn: async () => (await apiRequest("GET", "/technical/api/shipskart/vessels/sync/status")).json(),
    refetchInterval: (q) => (q.state.data?.running ? 4_000 : false),
  });

  const start = (preview: boolean) => ({
    mutationFn: async () =>
      (await apiRequest("POST", "/technical/api/shipskart/vessels/sync", preview ? { preview: true } : {})).json(),
    onSuccess: (d: any) => {
      toast({
        title: d?.started ? (preview ? "Check started" : "Vessel sync started") : "Not started",
        description: d?.started
          ? "Running in the background — the table below fills in as it goes. You can leave this page."
          : String(d?.message ?? ""),
        variant: d?.started ? undefined : ("destructive" as const),
      });
      queryClient.invalidateQueries({ queryKey: ["shipskart-vessel-sync-status"] });
    },
    onError: (e: any) => toast({ title: "Could not start", description: String(e?.message ?? e), variant: "destructive" as const }),
  });

  const checkMutation = useMutation(start(true));
  const runMutation = useMutation(start(false));

  const running = statusQuery.data?.running ?? false;
  const result = statusQuery.data?.lastRun ?? null;

  return (
    <Card data-testid="vessel-sync-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Ship className="h-4 w-4 text-blue-600" />Vessels on Shipskart</CardTitle>
        <CardDescription>
          A vessel must exist on Shipskart before crew can be linked to it or its catalogue pushed. This matches each of our
          vessels to Shipskart by IMO number — using the existing one where there is one, creating it only when there is not —
          and then completes any crew links that were waiting for it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending || running} data-testid="btn-vessel-check">
            {running && result?.preview !== false ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>) : (<><Eye className="h-4 w-4 mr-2" />Check first (changes nothing)</>)}
          </Button>
          <Button onClick={() => runMutation.mutate()} disabled={running || runMutation.isPending} data-testid="btn-vessel-sync">
            {running ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</>) : (<><RefreshCw className="h-4 w-4 mr-2" />Sync vessels now</>)}
          </Button>
          {running && <Badge variant="secondary" className="animate-pulse">Running in background</Badge>}
          {result && !running && (
            <span className="text-sm text-gray-500">
              {result.preview ? "Check" : "Last run"} {result.finishedAt ? new Date(result.finishedAt).toLocaleString() : ""}
            </span>
          )}
        </div>

        {result && (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.totals).map(([k, n]) => (
                <Badge key={k} variant="secondary" className="font-normal">{friendlyOutcome(k)}: {n}</Badge>
              ))}
            </div>
            {result.errors.length > 0 && (
              <p className="text-sm text-red-700 bg-red-50 rounded p-2">
                <AlertTriangle className="h-4 w-4 inline mr-1" />{result.errors[0]}
                {result.errors.length > 1 && ` (+${result.errors.length - 1} more)`}
              </p>
            )}
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vessel</TableHead>
                    <TableHead>IMO</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Crew links</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((r) => (
                    <TableRow key={r.vesselId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.imo ?? "—"}</TableCell>
                      <TableCell className="text-xs">{friendlyOutcome(r.outcome)}</TableCell>
                      <TableCell className="text-xs">
                        {r.mapped || r.unmapped ? `${r.mapped ?? 0} linked${r.unmapped ? `, ${r.unmapped} removed` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.detail ?? ""}>{r.detail ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Outcome codes in the domain team's language. */
function friendlyOutcome(code: string): string {
  switch (code) {
    case "adopted": return "Linked to the existing Shipskart vessel";
    case "would_adopt": return "Would link to the existing Shipskart vessel";
    case "repointed": return "Corrected — was pointing at the wrong Shipskart vessel";
    case "would_repoint": return "Would correct a wrong link";
    case "pushed": return "Created on Shipskart";
    case "would_create": return "Would be created on Shipskart";
    case "already_pushed": case "already_linked": return "Already correct";
    case "invalid_imo": return "IMO number is blank — fill it in the vessel record";
    case "lookup_failed": return "Could not reach Shipskart — safe to retry";
    case "blocked_duplicate": return "Shipskart refused it as a duplicate";
    case "error": return "Shipskart returned an error";
    default: return code;
  }
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone: "ok" | "warn" | "neutral" }) {
  const toneCls = tone === "ok" ? "text-green-700 bg-green-50" : tone === "warn" ? "text-amber-700 bg-amber-50" : "text-gray-700 bg-gray-50";
  return (
    <div className={`rounded p-3 ${toneCls}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

/** Turn stored API errors into domain-readable reasons; full text stays in the tooltip. */
function friendlyError(err: string | null): string {
  if (!err) return "Unknown error";
  if (/no pushed Shipskart vessel link/.test(err)) return "This vessel does not exist on Shipskart yet — enable automatic sync (or ask support to link it), then push again";
  if (/listing .* failed/.test(err)) return "Could not read Shipskart's existing catalogue (connection/signature issue) — nothing was pushed; safe to retry";
  if (/RATE_LIMITED|429/.test(err)) return "Shipskart rate limit — will succeed on retry once the limit resets";
  if (/SKU CODE COLLISION/.test(err)) return "Part code clashes with another vessel's — needs a decision (see tooltip)";
  if (/SANITIZE COLLISION/.test(err)) return "Two part codes become identical after formatting — needs a decision (see tooltip)";
  if (/NAME-MISMATCH/.test(err)) return "Pushed, but the shared category name differs between vessels (informational)";
  return err.length > 90 ? err.slice(0, 90) + "…" : err;
}
