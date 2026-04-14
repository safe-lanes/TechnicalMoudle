import { useMemo } from "react";
import { useLocalVessels, useExternalVessels } from "@/hooks/useExternalMasterData";
import { useUIRole } from "@/contexts/UIRoleContext";

const EXTERNAL_ALLOWED_VESSEL_IDS = [
  "744dc41e-841a-11ed-aa7c-7003bca91a86",
  "4fbd2fab-85d2-11ed-aa7c-7003bca91a86",
];

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
  const { isExternal } = useUIRole();

  const {
    data: externalVesselEntries = [],
    isLoading: isLoadingExternal,
    error: externalError,
  } = useExternalVessels();

  const externalVessels = useMemo(
    () => mapEntriesToVessels(externalVesselEntries),
    [externalVesselEntries]
  );
  const hasUsableExternalData = externalVessels.length > 0;

  const {
    data: localVesselEntries = [],
    isLoading: isLoadingLocal,
    error: localError,
  } = useLocalVessels({
    enabled: !hasUsableExternalData && !isLoadingExternal,
  });

  const isLoading = isLoadingExternal || (!hasUsableExternalData && isLoadingLocal);
  const error = hasUsableExternalData ? externalError : localError;

  const vessels: Vessel[] = useMemo(() => {
    const all = hasUsableExternalData
      ? externalVessels
      : mapEntriesToVessels(localVesselEntries);

    if (isExternal) {
      return all.filter(v => EXTERNAL_ALLOWED_VESSEL_IDS.includes(v.id));
    }
    return all;
  }, [hasUsableExternalData, externalVessels, localVesselEntries, isExternal]);

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
