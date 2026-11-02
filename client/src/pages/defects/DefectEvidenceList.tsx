import { defectEvidenceLabel, type ResolvedDefectEvidence } from "@shared/defectEvidence";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { defectFileHeaders, fetchDefectFile } from "./DefectAttachmentDialog";

function EvidenceRow({ file }: { file: ResolvedDefectEvidence }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (file.external && file.href && !file.staged) {
      fetch(`${file.href}/status`, { headers: defectFileHeaders(currentUser ?? undefined), credentials: "include" })
        .then(async response => { if (!response.ok) throw new Error((await response.json()).error); })
        .then(() => { if (!cancelled) setState(""); })
        .catch(error => { if (!cancelled) setState(error.message || "File status could not be checked."); });
    }
    return () => { cancelled = true; };
  }, [file.href, file.external, file.staged, currentUser?.userUuid]);
  async function open() {
    try {
      if (file.external) {
        const blob = await fetchDefectFile(file.href!, defectFileHeaders(currentUser ?? undefined));
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else if (file.href?.startsWith("data:")) {
        const [header, encoded] = file.href.split(",");
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(5).split(";")[0] }));
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else window.open(file.href, "_blank", "noopener,noreferrer");
    } catch (error: any) { setState(error.message); }
  }
  return <li className="break-all">
    {file.href ? <button type="button" className="text-blue-700 underline text-left" onClick={() => void open()}>{defectEvidenceLabel(file)}</button>
      : <span className={file.source === "unavailable" ? "text-amber-800" : "text-gray-700"}>{defectEvidenceLabel(file)}</span>}
    {state && <p role="status" className="text-xs text-amber-800">{state}</p>}
  </li>;
}

/** Render resolved references without changing their IDs or attachment ownership. */
export function DefectEvidenceList({ files }: { files: ResolvedDefectEvidence[] }) {
  if (!files.length) return <p className="text-sm text-gray-500">No closure evidence selected.</p>;
  return <ul className="space-y-1 text-sm">
    {files.map((file, index) => <EvidenceRow key={`${file.id}-${index}`} file={file} />)}
  </ul>;
}
