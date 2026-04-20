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
  const {
    data: externalVesselEntries = [],
    isLoading: isLoadingExternal,
    error: externalError,
    isSuccess: externalIsSuccess,
  } = useExternalVessels();

  const externalVessels = useMemo(
    () => mapEntriesToVessels(externalVesselEntries),
    [externalVesselEntries]
  );

  const externalResolved = !isLoadingExternal;
  const useExternal = externalIsSuccess && externalVessels.length > 0;
  const externalFailed = externalResolved && !useExternal;

  const {
    data: localVesselEntries = [],
    isLoading: isLoadingLocal,
    error: localError,
  } = useLocalVessels({
    enabled: true,
  });

  const localVessels = useMemo(
    () => mapEntriesToVessels(localVesselEntries),
    [localVesselEntries]
  );

  const isLoading = isLoadingExternal || (externalFailed && isLoadingLocal);
  const error = useExternal ? externalError : localError;

  const vessels: Vessel[] = useMemo(() => {
    if (!useExternal) return localVessels;
    // Merge: external is authoritative; include any local-only vessels so
    // work orders / records referencing vessels not yet synced to the
    // external master list still resolve to a name.
    const externalIds = new Set(externalVessels.map(v => v.id));
    const localOnly = localVessels.filter(v => !externalIds.has(v.id));
    if (localOnly.length === 0) return externalVessels;
    return [...externalVessels, ...localOnly].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [useExternal, externalVessels, localVessels]);

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
