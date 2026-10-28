/**
 * Job Form "Work Instructions" — PDF attachments on Vessel Jobs (mig 183, 25-Oct-2026).
 * Requirement: Jeevan "Job Form – Work Instructions" §2-§4, §7-§11, §15-§16, §19.
 *
 * Two parts: (1) PDF attachments — list / open / download / upload / attach existing / remove / restore;
 * (2) "Feature coming soon" — static. Office users with Job edit rights manage; vessel users and ships are read-only.
 *
 * Opened from:
 *   - the Job Form with `jobId` (editable unless `readOnly`)
 *   - the Work Order form with `workOrderId` → shows the linked Job's CURRENT list, always read-only (§15/§16)
 *   - the legacy WO forms with neither → the dialog explains that instructions are managed on the Job.
 * Every prop except isOpen/onClose is optional, so existing callers keep working unchanged.
 */
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ExternalLink, FileText, Link2, RotateCcw, Trash2, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiErrorMessage";
import { downloadAuthedFile, viewAuthedDocument } from "@/lib/authedDownload";
import { useToast } from "@/hooks/use-toast";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";

interface WorkInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The Job (juuid or id) whose Work Instructions are shown and managed. */
  jobId?: string | null;
  /** A Work Order: shows its linked Job's current Work Instructions, read-only. */
  workOrderId?: string | null;
  /** The Job's vessel (vuuid) — needed for "Attach existing". */
  vesselId?: string | null;
  /** Force read-only (e.g. a user without Job edit rights). Ships are always read-only. */
  readOnly?: boolean;
  /** An unsaved new Job: actions are disabled with an explanation (§4). */
  jobUnsaved?: boolean;
}

interface LinkRow {
  jwluuid: string; jobId: string; vesselId: string; isDeleted: boolean; attachedAt: string;
  file: { jwfuuid: string; fileName: string; fileSize: number | null; revisionRemarks: string | null; uploadedAt: string; isDeleted: boolean } | null;
}
interface VesselFile { jwfuuid: string; fileName: string; fileSize: number | null; revisionRemarks: string | null; uploadedAt: string }

const fmtSize = (n: number | null | undefined) => (n == null ? "" : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDate = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : "");
export const workInstructionsQueryKey = (jobId: string | null | undefined, includeRemoved: boolean) =>
  ["/technical/api/jobs", jobId ?? null, "work-instructions", includeRemoved] as const;

const WorkInstructionsDialog: React.FC<WorkInstructionsDialogProps> = ({ isOpen, onClose, jobId, workOrderId, vesselId, readOnly = false, jobUnsaved = false }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isShip } = useSyncInstanceInfo();
  const [showRemoved, setShowRemoved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const viaWorkOrder = !jobId && !!workOrderId;
  const canManage = !readOnly && !isShip && !viaWorkOrder && !!jobId;
  const listUrl = jobId
    ? `/technical/api/jobs/${encodeURIComponent(jobId)}/work-instructions${showRemoved ? "?includeRemoved=1" : ""}`
    : workOrderId ? `/technical/api/work-orders/${encodeURIComponent(workOrderId)}/work-instructions` : null;

  const list = useQuery<LinkRow[]>({
    queryKey: jobId ? workInstructionsQueryKey(jobId, showRemoved) : ["/technical/api/work-orders", workOrderId ?? null, "work-instructions"],
    enabled: isOpen && !!listUrl && !jobUnsaved,
    retry: false,
    queryFn: async () => {
      const res = await fetch(listUrl!);
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // never shown as "no attachments" (§2)
      return res.json();
    },
  });
  const picker = useQuery<VesselFile[]>({
    queryKey: ["/technical/api/vessels", vesselId ?? null, "work-instruction-files"],
    enabled: isOpen && showPicker && !!vesselId,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/technical/api/vessels/${encodeURIComponent(vesselId!)}/work-instruction-files`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const rows = list.data ?? [];
  const active = useMemo(() => rows.filter((r) => !r.isDeleted), [rows]);
  const removed = useMemo(() => rows.filter((r) => r.isDeleted), [rows]);
  const attachedFileIds = useMemo(() => new Set(active.map((r) => r.file?.jwfuuid)), [active]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["/technical/api/jobs", jobId ?? null, "work-instructions"] });
    void queryClient.invalidateQueries({ queryKey: ["/technical/api/vessels", vesselId ?? null, "work-instruction-files"] });
  };
  const run = async (key: string, fn: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(key);
    try { await fn(); toast({ title: done }); refresh(); }
    catch (error) { toast({ title: failed, description: apiErrorMessage(error, "Please try again."), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const onUpload = async (file: File) => {
    if (!jobId) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      toast({ title: "Only PDF files can be attached", variant: "destructive" }); return;
    }
    const body = new FormData();
    body.append("file", file);
    if (remarks.trim()) body.append("revisionRemarks", remarks.trim());
    await run("upload", async () => {
      const res = await fetch(`/technical/api/jobs/${encodeURIComponent(jobId)}/work-instructions/upload`, { method: "POST", body, credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      setRemarks("");
    }, `"${file.name}" uploaded and attached`, "Upload failed");
  };
  const onAttach = (f: VesselFile) => run(`attach-${f.jwfuuid}`, () =>
    apiRequest("POST", `/technical/api/jobs/${encodeURIComponent(jobId!)}/work-instructions/attach`, { fileUuid: f.jwfuuid }),
    `"${f.fileName}" attached`, "Could not attach");
  const onRemove = (r: LinkRow) => run(`remove-${r.jwluuid}`, () =>
    apiRequest("DELETE", `/technical/api/jobs/${encodeURIComponent(jobId!)}/work-instructions/${r.jwluuid}`),
    `"${r.file?.fileName ?? "Attachment"}" removed from this Job`, "Could not remove");
  const onRestore = (r: LinkRow) => run(`restore-${r.jwluuid}`, () =>
    apiRequest("POST", `/technical/api/jobs/${encodeURIComponent(jobId!)}/work-instructions/${r.jwluuid}/restore`),
    `"${r.file?.fileName ?? "Attachment"}" restored`, "Could not restore");
  const openUrl = (f: { jwfuuid: string }, inline: boolean) =>
    `/technical/api/work-instruction-files/${encodeURIComponent(f.jwfuuid)}/download${inline ? "?inline=1" : ""}`;
  // Open / Download go through the patched `fetch` (Bearer + x-user-* headers), never a plain link:
  // a browser navigation carries no identity, which a multi-tenant office refuses with 401 (28-Oct-2026,
  // QA WI-03/WI-04/WO-02/WO-04 "works on the vessel, error in the office"). Same pattern as the other documents.
  const onOpen = (f: { jwfuuid: string; fileName: string }) =>
    viewAuthedDocument(openUrl(f, true)).catch((error) =>
      toast({ title: `Could not open "${f.fileName}"`, description: apiErrorMessage(error, "Please try again."), variant: "destructive" }));
  const onDownload = (f: { jwfuuid: string; fileName: string }) =>
    downloadAuthedFile(openUrl(f, false), f.fileName).catch((error) =>
      toast({ title: `Could not download "${f.fileName}"`, description: apiErrorMessage(error, "Please try again."), variant: "destructive" }));

  const Row = ({ r }: { r: LinkRow }) => (
    <div className="flex items-center gap-3 rounded border border-gray-200 px-3 py-2" data-testid={`wi-row-${r.jwluuid}`}>
      <FileText className="h-4 w-4 flex-shrink-0 text-[#16569e]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">{r.file?.fileName ?? "(file missing)"}</div>
        <div className="text-xs text-gray-500">
          {fmtSize(r.file?.fileSize)}{r.file?.uploadedAt ? ` · uploaded ${fmtDate(r.file.uploadedAt)}` : ""}{r.file?.revisionRemarks ? ` · ${r.file.revisionRemarks}` : ""}{r.isDeleted ? " · removed" : ""}
        </div>
      </div>
      {r.file && !r.isDeleted && (
        <>
          <Button type="button" variant="ghost" size="sm" title="Open" onClick={() => void onOpen(r.file!)} data-testid={`wi-open-${r.jwluuid}`}><ExternalLink className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="sm" title="Download" onClick={() => void onDownload(r.file!)} data-testid={`wi-download-${r.jwluuid}`}><Download className="h-4 w-4" /></Button>
        </>
      )}
      {canManage && !r.isDeleted && (
        <Button variant="ghost" size="sm" title="Remove from this Job" disabled={busy !== null} onClick={() => void onRemove(r)} data-testid={`wi-remove-${r.jwluuid}`}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      )}
      {canManage && r.isDeleted && (
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void onRestore(r)} data-testid={`wi-restore-${r.jwluuid}`}>
          <RotateCcw className="mr-1 h-4 w-4" /> Restore
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold text-[#16569e]">Work Instructions</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Part 1 — PDF attachments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">PDF attachments</h4>
              {jobId && (removed.length > 0 || showRemoved) && (
                <button type="button" className="text-xs text-[#1570ef]" onClick={() => setShowRemoved((v) => !v)} data-testid="wi-toggle-removed">
                  {showRemoved ? "Hide removed" : `Show removed (${removed.length})`}
                </button>
              )}
            </div>

            {!jobId && !workOrderId && (
              <p className="text-sm text-gray-600" data-testid="wi-no-context">Work Instructions are attached to the Job. Open the Job form to view or manage them.</p>
            )}
            {jobUnsaved && (
              <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="wi-unsaved">Save the Job first, then attach Work Instructions.</p>
            )}
            {!jobUnsaved && listUrl && list.isLoading && <p className="text-sm text-gray-500">Loading Work Instructions…</p>}
            {!jobUnsaved && list.isError && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="wi-error">
                Could not load the Work Instructions. <Button variant="outline" size="sm" className="ml-2" onClick={() => void list.refetch()}>Retry</Button>
              </div>
            )}
            {!jobUnsaved && list.isSuccess && active.length === 0 && !showRemoved && (
              <p className="text-sm text-gray-500" data-testid="wi-empty">No Work Instructions attached{viaWorkOrder ? " to this Work Order's Job" : ""}.</p>
            )}
            {list.isSuccess && active.map((r) => <Row key={r.jwluuid} r={r} />)}
            {list.isSuccess && showRemoved && removed.length > 0 && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-xs font-medium text-gray-500">Removed</div>
                {removed.map((r) => <Row key={r.jwluuid} r={r} />)}
              </div>
            )}

            {isShip && (jobId || workOrderId) && (
              <p className="text-xs text-gray-500" data-testid="wi-ship-note">Work Instructions are managed in the office and reach this vessel by sync.</p>
            )}

            {canManage && !jobUnsaved && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" data-testid="wi-file-input"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUpload(f); }} />
                  <Button type="button" size="sm" disabled={busy !== null} onClick={() => fileInput.current?.click()} data-testid="wi-upload">
                    <Upload className="mr-1 h-4 w-4" /> {busy === "upload" ? "Uploading…" : "Upload PDF"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy !== null || !vesselId} onClick={() => setShowPicker((v) => !v)} data-testid="wi-attach-existing">
                    <Link2 className="mr-1 h-4 w-4" /> Attach existing
                  </Button>
                  <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Revision / remarks (optional)" className="h-9 max-w-xs text-sm" data-testid="wi-remarks" />
                </div>
                <p className="text-xs text-gray-500">PDF only, up to 25 MB. The same PDF can be attached to several Jobs of this vessel.</p>
                {showPicker && (
                  <div className="rounded border border-gray-200 p-2" data-testid="wi-picker">
                    <div className="mb-1 text-xs font-medium text-gray-600">This vessel's Work Instruction files</div>
                    {picker.isLoading && <p className="text-xs text-gray-500">Loading…</p>}
                    {picker.isError && <p className="text-xs text-red-600">Could not load the vessel's files.</p>}
                    {picker.isSuccess && picker.data.length === 0 && <p className="text-xs text-gray-500">No files uploaded for this vessel yet.</p>}
                    {picker.isSuccess && picker.data.map((f) => (
                      <div key={f.jwfuuid} className="flex items-center justify-between py-1 text-sm">
                        <span className="truncate">{f.fileName} <span className="text-xs text-gray-500">{fmtSize(f.fileSize)}</span></span>
                        {attachedFileIds.has(f.jwfuuid)
                          ? <span className="text-xs text-gray-500">attached</span>
                          : <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void onAttach(f)} data-testid={`wi-attach-${f.jwfuuid}`}>Attach</Button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Part 2 — reserved (§3) */}
          <section className="rounded border border-dashed border-gray-300 p-4" data-testid="wi-coming-soon">
            <h4 className="font-medium text-gray-700">Feature coming soon</h4>
            <p className="text-sm text-gray-500">This section is reserved for future Work Instruction functionality.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkInstructionsDialog;
