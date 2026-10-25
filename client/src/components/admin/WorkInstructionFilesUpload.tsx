/**
 * Work Instruction PDFs — multi-file upload for a vessel (Admin → Bulk Upload → Jobs).
 * Stores many PDFs for the vessel in one go WITHOUT attaching them to Jobs; the Jobs sheet then names them in its
 * "Job attachments" column. Same rules as the Job form upload: PDF only, max 25 MB, one active name per vessel.
 * Office only — on a ship the card says so and offers nothing.
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";

type UploadResult = {
  uploaded: Array<{ fileName: string; jwfuuid: string; fileSize: number | null }>;
  skipped: Array<{ fileName: string; reason: string }>;
  refused: Array<{ fileName: string; reason: string }>;
};

export default function WorkInstructionFilesUpload({ vesselId }: { vesselId: string }) {
  const { isShip } = useSyncInstanceInfo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setFiles([]); setResult(null); setError(null); if (inputRef.current) inputRef.current.value = ""; };

  const send = async () => {
    if (!vesselId || files.length === 0) return;
    setBusy(true); setError(null); setResult(null);
    const body = new FormData();
    files.forEach((f) => body.append("files", f, f.name));
    if (remarks.trim()) body.append("revisionRemarks", remarks.trim());
    try {
      const res = await fetch(`/technical/api/vessels/${encodeURIComponent(vesselId)}/work-instruction-files/upload`, { method: "POST", body, credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || `Upload failed (${res.status})`);
      setResult(json as UploadResult);
      setFiles([]); if (inputRef.current) inputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["work-instruction-files", vesselId] });
      toast({ title: `${(json as UploadResult).uploaded.length} PDF(s) uploaded`, description: "Name them in the \"Job attachments\" column of the Jobs sheet to attach them to Jobs." });
    } catch (e: any) {
      setError(e?.message || "Upload failed. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <Card className="mb-4" data-testid="wif-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Work Instruction PDFs (for the Jobs import)</CardTitle>
        <CardDescription>
          Upload the vessel's Work Instruction PDFs here in one go (PDF only, max 25 MB each, one name per vessel). They are stored for the
          vessel only — to attach them to Jobs, type their file names, separated by ";", in the "Job attachments" column of the Jobs sheet below,
          or use "Attach existing" on a Job form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isShip ? (
          <p className="text-sm text-muted-foreground" data-testid="wif-ship-note">Work Instructions are managed in the office. They reach this vessel by sync.</p>
        ) : !vesselId ? (
          <p className="text-sm text-muted-foreground">Select a vessel first.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple disabled={busy} data-testid="wif-input"
                onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setResult(null); setError(null); }} className="md:max-w-md" />
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Revision remarks (optional, applied to all)" disabled={busy} data-testid="wif-remarks" className="md:max-w-xs" />
              <Button onClick={() => void send()} disabled={busy || files.length === 0} data-testid="wif-upload">
                <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading…" : `Upload ${files.length || ""} PDF${files.length === 1 ? "" : "s"}`}
              </Button>
              {(files.length > 0 || result) && <Button variant="ghost" onClick={reset} disabled={busy}>Clear</Button>}
            </div>
            {files.length > 0 && !result && (
              <p className="text-xs text-muted-foreground" data-testid="wif-selected">{files.length} file(s) selected: {files.slice(0, 8).map((f) => f.name).join(", ")}{files.length > 8 ? ", …" : ""}</p>
            )}
            {error && <p className="text-sm text-red-600" data-testid="wif-error">{error}</p>}
            {result && (
              <div className="text-sm space-y-1" data-testid="wif-result">
                <p className="font-medium">Uploaded {result.uploaded.length} · Skipped {result.skipped.length} · Refused {result.refused.length}</p>
                {result.uploaded.length > 0 && <p className="text-green-700">Uploaded: {result.uploaded.map((f) => f.fileName).join(", ")}</p>}
                {result.skipped.map((s) => <p key={`s-${s.fileName}`} className="text-amber-700">Skipped {s.fileName} — {s.reason}</p>)}
                {result.refused.map((r) => <p key={`r-${r.fileName}`} className="text-red-700">Refused {r.fileName} — {r.reason}</p>)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
