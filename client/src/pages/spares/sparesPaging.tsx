import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SparePage } from "@shared/sparesPagination";
import { getAccessToken } from "@/lib/authToken";

function requestOptions(signal?: AbortSignal): RequestInit {
  const token = getAccessToken();
  return { signal, credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} };
}

export function useSpareSearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setSearch(value), 300); return () => clearTimeout(timer); }, [value]);
  return search;
}
export function spareUrl(vesselId: string, query: Record<string, any>, action = "paged") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "")
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  // An explicit empty allow-list must never disappear from a My Vessels URL.
  if (query.vesselIds === "") params.set("vesselIds", "");
  params.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  return `/technical/api/spares/${encodeURIComponent(vesselId)}/${action}?${params}`;
}
export function useSparePage(url: string, enabled: boolean, legacyPrefix = "/technical/api/inventory/spares-with-inventory") {
  return useQuery<SparePage>({
    queryKey: [legacyPrefix, url], enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch(url, requestOptions(signal));
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not load Spares");
      }
      return (await response.json()).data;
    },
  });
}
export async function downloadSpareExport(url: string, filename: string, assertCurrent: () => void) {
  assertCurrent();
  const response = await fetch(url, requestOptions());
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Spares export failed");
  }
  const metadata = {
    excluded: Number(response.headers.get("X-Excluded-Unavailable-Spare-Links") || 0),
    rowCount: Number(response.headers.get("X-Spare-Export-Row-Count") || 0),
  };
  if (metadata.rowCount === 0) { assertCurrent(); await response.body?.cancel(); return metadata; }
  const blob = await response.blob();
  assertCurrent();
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob); anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
  return metadata;
}
export function SpareLocationPager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="flex items-center justify-between gap-2 p-2 text-xs border-t" data-testid="spares-location-pagination">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span>{page} / {pages} ({total} locations)</span>
    <button disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>;
}
