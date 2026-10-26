import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StorePage } from "@shared/storesPagination";

export function useStoreSearch(value: string) {
  const [effective, setEffective] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setEffective(value), 300); return () => clearTimeout(timer); }, [value]);
  return effective;
}
export async function storesJson(url: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(url, { signal, ...(body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Stores request failed");
  }
  return response.json();
}
export function storeUrl(vesselId: string, query: Record<string, any>, action = "paged") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  params.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  return `/technical/api/stores/${encodeURIComponent(vesselId)}/${action}?${params}`;
}
export function useStorePage(url: string, enabled: boolean) {
  return useQuery<StorePage>({
    queryKey: [url], enabled,
    queryFn: async ({ signal }) => (await storesJson(url, undefined, signal)).data,
  });
}
export async function downloadStoreExport(url: string, filename: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Stores export failed");
  const blob = await response.blob();
  if (signal?.aborted) throw new Error("Export cancelled because scope changed");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
export function StoresPager({ page, size, total, onPage, onSize }: {
  page: number; size: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="flex items-center justify-between gap-3 border-t bg-gray-50 p-3 text-sm" data-testid="stores-server-pagination">
    <label>Show <select aria-label="Items per page" value={size} onChange={e => { onSize(Number(e.target.value)); onPage(1); }}>
      {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label>
    <span>Showing {total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} of {total}</span>
    <div className="flex gap-3 items-center">
      <button disabled={page <= 1} onClick={() => onPage(1)}>First</button>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button disabled={page >= pages || !total} onClick={() => onPage(page + 1)}>Next</button>
      <button disabled={page >= pages || !total} onClick={() => onPage(pages)}>Last</button>
    </div>
  </div>;
}
