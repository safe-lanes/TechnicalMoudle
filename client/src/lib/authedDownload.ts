/**
 * Authenticated file download / view helpers.
 *
 * Browser navigations (`window.open` / `<a href>` to /technical/api) cannot carry
 * the Authorization header, so under multi-tenant mode (Phase 2 `tenantMiddleware`)
 * they 401. These helpers route the request through the patched `window.fetch`
 * (see `installRankFetchInterceptor` in activeRank.ts), which injects the SAILERP
 * Bearer — the server then verifies the JWT, resolves the correct tenant DB, and
 * returns the file. The bytes become an in-memory blob URL for download/preview,
 * so no credential ever appears in a URL and no separate cookie is needed.
 *
 * Flag off (single-tenant): identical outcome — the fetch still succeeds (mock auth
 * admits it) and the same file is downloaded/opened.
 */

const FILENAME_FALLBACK = "download";

/** Pull the filename from a Content-Disposition header (RFC 5987 `filename*` first). */
function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*\s*=\s*(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (star && star[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = header.match(/filename\s*=\s*["']?([^"';]+)["']?/i);
  return plain && plain[1] ? plain[1].trim() : null;
}

/** Save a blob to disk via a transient anchor (no new tab). */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke after the click has initiated the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Decode a `data:<mime>;base64,<...>` URL into a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const byteChars = atob(base64Data);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  return new Blob([byteArray], { type: mime });
}

/**
 * Fetch a file-stream endpoint WITH auth and save it via an anchor download.
 * Filename comes from the response Content-Disposition, else `fallbackName`,
 * else "download". For binary/CSV download endpoints (e.g. component documents,
 * running-hours CSV export).
 */
export async function downloadAuthedFile(url: string, fallbackName?: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const name =
    parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ||
    fallbackName ||
    FILENAME_FALLBACK;
  triggerBlobDownload(blob, name);
}

/**
 * Fetch a document endpoint WITH auth and open it in a new tab. Handles both
 * response shapes: JSON `{ dataUrl: "data:...base64" }` / `{ url }` (work-order
 * documents) and a raw file stream. Opens an in-memory blob URL so the Bearer is
 * only sent on the fetch, never in a navigated URL.
 */
export async function viewAuthedDocument(url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`View failed (${res.status})`);
  const contentType = res.headers.get("content-type") || "";

  let blob: Blob;
  if (contentType.includes("application/json")) {
    const json: any = await res.json();
    const dataUrl: string | undefined = json?.dataUrl || json?.url;
    if (dataUrl && dataUrl.startsWith("data:")) {
      blob = dataUrlToBlob(dataUrl);
    } else if (dataUrl) {
      // Server returned a ready-to-open URL (e.g. external storage) — open directly.
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    } else {
      throw new Error("Document response contained no data");
    }
  } else {
    blob = await res.blob();
  }

  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  // Keep the URL alive long enough for the new tab to load, then revoke.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
