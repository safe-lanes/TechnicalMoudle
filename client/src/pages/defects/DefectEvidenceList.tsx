import { defectEvidenceLabel, type ResolvedDefectEvidence } from "@shared/defectEvidence";

/** Render resolved references without changing their IDs or attachment ownership. */
export function DefectEvidenceList({ files }: { files: ResolvedDefectEvidence[] }) {
  if (!files.length) return <p className="text-sm text-gray-500">No closure evidence selected.</p>;
  function openFile(href: string) {
    if (!href.startsWith("data:")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    const [header, encoded] = href.split(",");
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(5).split(";")[0] }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return <ul className="space-y-1 text-sm">
    {files.map((file, index) => <li key={`${file.id}-${index}`} className="break-all">
      {file.href
        ? <button type="button" className="text-blue-700 underline text-left" onClick={() => openFile(file.href!)}>{defectEvidenceLabel(file)}</button>
        : <span className={file.source === "unavailable" ? "text-amber-800" : "text-gray-700"}>{defectEvidenceLabel(file)}</span>}
    </li>)}
  </ul>;
}
