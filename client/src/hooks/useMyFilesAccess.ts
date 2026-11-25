import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/authToken";

/**
 * Whether the logged-in role may VIEW My Files for one module. The My Files server owns these permissions
 * (Access Control pushes them there), so we ask it instead of Technical's own RBAC.
 *
 * Returns false until the server says yes: the menu entry stays hidden while loading, on any error, and when
 * My Files is not installed. The page itself still shows "No access" if someone opens the link directly.
 */
export async function fetchMyFilesView(moduleCode: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`/m/api/v1/modules-access/me?moduleCode=${encodeURIComponent(moduleCode)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { view?: unknown } };
    return body?.data?.view === true;
  } catch {
    return false;
  }
}

export function useMyFilesAccess(moduleCode: string): boolean {
  const [canView, setCanView] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchMyFilesView(moduleCode, getAccessToken()).then((view) => {
      if (!cancelled) setCanView(view);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleCode]);
  return canView;
}
