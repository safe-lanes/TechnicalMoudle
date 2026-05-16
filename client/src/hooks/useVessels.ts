import { useMemo } from "react";
import { useLocalVessels, useExternalVessels } from "@/hooks/useExternalMasterData";

interface Vessel {
  id: string;
  name: string;
  code: string;
  imoNumber?: string;
  vesselType?: string;
}

function mapEntriesToVessels(entries: any[]): Vessel[] {
  return entries
    .filter((entry: any) => entry.vuid || entry.vuuid || entry.vesselId || entry.id)
    .map((entry: any) => ({
      id: String(entry.vuid || entry.vuuid || entry.vesselId || entry.id),
      name: String(entry.vessel || entry.vesselName || entry.name || ''),
      code: String(entry.vuid || entry.vuuid || entry.vesselId || entry.code || entry.id),
      imoNumber: String(entry.imoNumber || entry.imo_number || ''),
      vesselType: String(entry.vesselType || entry.vessel_type || ''),
    }))
    .sort((a: Vessel, b: Vessel) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
}

export function useVessels() {
  // Local is the primary source — always fetched.
  const {
    data: localVesselEntries = [],
    isLoading: isLoadingLocal,
    error: localError,
  } = useLocalVessels({ enabled: true });

  const localVessels = useMemo(
    () => mapEntriesToVessels(localVesselEntries),
    [localVesselEntries]
  );

  const localResolved = !isLoadingLocal;
  // Data-driven check: any usable rows means we keep using local even if a
  // background refetch later errors out (cached data must not trigger the
  // external fallback).
  const localHasData = localVessels.length > 0;
  // Fall back to external only when local has resolved with zero usable
  // vessels (empty success or error). On a healthy install this never fires,
  // so dropdowns avoid the external Master Data round-trip entirely.
  const shouldUseExternal = localResolved && !localHasData;

  const {
    data: externalVesselEntries = [],
    isLoading: isLoadingExternal,
    error: externalError,
  } = useExternalVessels({ enabled: shouldUseExternal });

  const externalVessels = useMemo(
    () => mapEntriesToVessels(externalVesselEntries),
    [externalVesselEntries]
  );

  const isLoading = isLoadingLocal || (shouldUseExternal && isLoadingExternal);
  const error = localHasData ? localError : (shouldUseExternal ? externalError : localError);

  const vessels: Vessel[] = useMemo(() => {
    if (!localHasData) {
      // Local empty/errored → external is the only source.
      return externalVessels;
    }
    if (externalVessels.length === 0) {
      // External not fetched (or returned empty) → local-only.
      return localVessels;
    }
    // Both available: local is authoritative; merge in any external-only
    // vessels so historical references not yet mirrored locally still
    // resolve to a name in dropdowns.
    const localIds = new Set(localVessels.map(v => v.id));
    const externalOnly = externalVessels.filter(v => !localIds.has(v.id));
    if (externalOnly.length === 0) return localVessels;
    return [...localVessels, ...externalOnly].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [localHasData, localVessels, externalVessels]);

  return { data: vessels, isLoading, error };
}

export function useVesselOptions() {
  const { data: vessels = [], isLoading, error } = useVessels();

  const options = vessels.map(v => ({
    value: v.id,
    label: v.name || v.id,
  }));

  return { options, isLoading, error, vessels };
}
