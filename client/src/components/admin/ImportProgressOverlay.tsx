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

    const handler = (e: BeforeUnloadEvent) => {
      if (!complete && !error) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);

    const isActive = !complete && !error;
    if (isActive) {
      document.body.style.pointerEvents = "none";
      const overlayEl = document.querySelector('[data-testid="import-progress-overlay"]') as HTMLElement | null;
      if (overlayEl) overlayEl.style.pointerEvents = "auto";
    }

    return () => {
      window.removeEventListener("beforeunload", handler);
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
              callbacks.onProgress(data);
            } else if (currentEvent === "complete") {
              callbacks.onComplete(data);
            } else if (currentEvent === "error") {
              callbacks.onError(data.message || "Unknown error");
            }
          } catch {}
          currentEvent = "";
        }
      }
    }
  };

  return { consumeStream };
}
