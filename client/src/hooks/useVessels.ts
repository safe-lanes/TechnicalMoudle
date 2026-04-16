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
    enabled: externalFailed,
  });

  const isLoading = isLoadingExternal || (externalFailed && isLoadingLocal);
  const error = useExternal ? externalError : localError;

  const vessels: Vessel[] = useMemo(() => {
    return useExternal
      ? externalVessels
      : mapEntriesToVessels(localVesselEntries);
  }, [useExternal, externalVessels, localVesselEntries]);

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
