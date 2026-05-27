import { useEffect } from "react";
import { Loader2, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export interface ImportProgressData {
  processed: number;
  total: number;
  remaining: number;
  percent: number;
  status: string;
  errors: number;
}

export interface ImportCompleteData {
  created?: number;
  updated?: number;
  skipped?: number;
  archived?: number;
  failed?: number;
  errors?: string[];
  historyId?: string;
  [key: string]: any;
}

interface ImportProgressOverlayProps {
  visible: boolean;
  progress: ImportProgressData | null;
  complete: ImportCompleteData | null;
  error: string | null;
  onClose: () => void;
  entityLabel?: string;
}

export default function ImportProgressOverlay({
  visible,
  progress,
  complete,
  error,
  onClose,
  entityLabel = "records",
}: ImportProgressOverlayProps) {
  useEffect(() => {
    if (!visible) return;

    const isActive = !complete && !error;

    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (isActive) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const popStateHandler = (e: PopStateEvent) => {
      if (isActive) {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);

    if (isActive) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", popStateHandler);
      document.body.style.pointerEvents = "none";
      const overlayEl = document.querySelector('[data-testid="import-progress-overlay"]') as HTMLElement | null;
      if (overlayEl) overlayEl.style.pointerEvents = "auto";
    }

    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      window.removeEventListener("popstate", popStateHandler);
      document.body.style.pointerEvents = "";
    };
  }, [visible, complete, error]);

  if (!visible) return null;

  const isComplete = !!complete;
  const isError = !!error;
  const isProcessing = !isComplete && !isError;

  const percent = progress?.percent ?? 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      data-testid="import-progress-overlay"
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        {isProcessing && (
          <>
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <h3 className="text-lg font-semibold" data-testid="import-progress-title">
                Importing {entityLabel}
              </h3>
            </div>

            <Progress value={percent} className="h-3" data-testid="import-progress-bar" />

            <div className="flex justify-between text-sm text-muted-foreground">
              <span data-testid="import-progress-count">
                {progress?.processed ?? 0} / {progress?.total ?? 0} processed
              </span>
              <span data-testid="import-progress-remaining">
                {progress?.remaining ?? 0} remaining
              </span>
              <span data-testid="import-progress-percent">{percent}%</span>
            </div>

            <p className="text-sm text-muted-foreground" data-testid="import-progress-status">
              {progress?.status || "Preparing…"}
            </p>

            {(progress?.errors ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span data-testid="import-progress-errors">{progress!.errors} error(s) so far</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
              <ShieldAlert className="h-4 w-4" />
              <span>Please do not close or navigate away during import.</span>
            </div>
          </>
        )}

        {isComplete && (
          <>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h3 className="text-lg font-semibold" data-testid="import-complete-title">
                Import Complete
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm" data-testid="import-complete-summary">
              {complete.created !== undefined && complete.created > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="import-complete-created">
                    {complete.created}
                  </div>
                  <div className="text-muted-foreground">Created</div>
                </div>
              )}
              {complete.updated !== undefined && complete.updated > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="import-complete-updated">
                    {complete.updated}
                  </div>
                  <div className="text-muted-foreground">Updated</div>
                </div>
              )}
              {complete.skipped !== undefined && complete.skipped > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400" data-testid="import-complete-skipped">
                    {complete.skipped}
                  </div>
                  <div className="text-muted-foreground">Skipped</div>
                </div>
              )}
              {complete.archived !== undefined && complete.archived > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="import-complete-archived">
                    {complete.archived}
                  </div>
                  <div className="text-muted-foreground">Archived</div>
                </div>
              )}
              {(complete.failed ?? 0) > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="import-complete-failed">
                    {complete.failed}
                  </div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
              )}
            </div>

            <Button onClick={onClose} className="w-full" data-testid="import-complete-close">
              Close
            </Button>
          </>
        )}

        {isError && (
          <>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400" data-testid="import-error-title">
                Import Failed
              </h3>
            </div>

            <p className="text-sm text-muted-foreground" data-testid="import-error-message">
              {error}
            </p>

            <Button onClick={onClose} variant="destructive" className="w-full" data-testid="import-error-close">
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Poll the server's import-status endpoint to recover the final outcome
// when the SSE stream is severed mid-import (e.g. by a proxy idle-timeout).
// Returns the resolved status payload, or null if it can't be determined
// within the timeout window.
async function pollImportStatus(
  historyId: string,
  callbacks: {
    onProgress: (data: ImportProgressData) => void;
  },
  lastProgress: ImportProgressData | null,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<{ status: string; created: number; updated: number; skipped: number; archived: number; failed?: number } | null> {
  const intervalMs = opts.intervalMs ?? 3000;
  // Cover even very long imports (~30 min) — server-side write work can outlast
  // a single 5-min window if the stream drops early in the run.
  const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`/technical/api/bulk/import-status/${historyId}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'complete' || data.status === 'failed') {
          return data;
        }
        // Still in_progress — re-emit the last known progress with an
        // updated status so the UI doesn't jump back to 0% / "Preparing…".
        callbacks.onProgress({
          processed: lastProgress?.processed ?? 0,
          total: lastProgress?.total ?? 0,
          remaining: lastProgress?.remaining ?? 0,
          percent: lastProgress?.percent ?? 0,
          status: 'Reconnecting… import is still running on the server',
          errors: lastProgress?.errors ?? 0,
        });
      }
      // 404 / 5xx → retry; the history row may not be written yet.
    } catch (_e) {
      // Network blip — keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export function useImportStream() {
  const consumeStream = async (
    url: string,
    options: RequestInit,
    callbacks: {
      onProgress: (data: ImportProgressData) => void;
      onComplete: (data: ImportCompleteData) => void;
      onError: (message: string) => void;
    }
  ) => {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errMsg = "Import request failed";
      try {
        const errBody = await response.json();
        errMsg = errBody.error || errMsg;
      } catch {}
      callbacks.onError(errMsg);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("Streaming not supported by the browser");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let receivedComplete = false;
    let receivedError = false;
    let knownHistoryId: string | null = null;
    let lastProgress: ImportProgressData | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (currentEvent === "progress") {
              if (data && typeof data.historyId === "string" && !knownHistoryId) {
                knownHistoryId = data.historyId;
              }
              lastProgress = data;
              callbacks.onProgress(data);
            } else if (currentEvent === "complete") {
              receivedComplete = true;
              callbacks.onComplete(data);
            } else if (currentEvent === "error") {
              receivedError = true;
              callbacks.onError(data.message || "Unknown error");
            }
          } catch (parseErr) {
            console.warn('SSE JSON parse error for event:', currentEvent, parseErr);
          }
          currentEvent = "";
        }
        // SSE comment lines (starting with ':') are heartbeats — ignore.
      }
    }

    if (receivedComplete || receivedError) return;

    // Stream ended without a terminal event. The server may still be running
    // (proxy idle-timeout, transient network drop). If we captured a
    // historyId, poll the status endpoint to recover the real outcome
    // instead of falsely reporting failure.
    if (knownHistoryId) {
      const final = await pollImportStatus(knownHistoryId, { onProgress: callbacks.onProgress }, lastProgress);
      if (final && final.status === 'complete') {
        callbacks.onComplete({
          created: final.created,
          updated: final.updated,
          skipped: final.skipped,
          archived: final.archived,
          failed: final.failed ?? 0,
          historyId: knownHistoryId,
        });
        return;
      }
      if (final && final.status === 'failed') {
        callbacks.onError("Import failed on the server. Check the import history for details.");
        return;
      }
    }

    callbacks.onError("Import stream ended unexpectedly. The import may have partially completed — please check the data before retrying.");
  };

  return { consumeStream };
}
