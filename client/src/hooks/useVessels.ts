import { useLocalVessels, useExternalVessels } from "@/hooks/useExternalMasterData";

interface Vessel {
  id: string;
  vuuid: string;
  name: string;
  code: string;
  imoNumber?: string;
  vesselType?: string;
}

export function useVessels() {
  const { 
    data: localVesselEntries = [], 
    isLoading: isLoadingLocal, 
    error: localError 
  } = useLocalVessels();
  
  const { 
    data: externalVesselEntries = [], 
    isLoading: isLoadingExternal, 
    error: externalError 
  } = useExternalVessels({ 
    enabled: localVesselEntries.length === 0 && !isLoadingLocal 
  });

  const hasLocalData = localVesselEntries.length > 0;
  const vesselEntries = hasLocalData ? localVesselEntries : externalVesselEntries;
  const isLoading = isLoadingLocal || (!hasLocalData && isLoadingExternal);
  const error = hasLocalData ? localError : externalError;

  const vessels: Vessel[] = vesselEntries
    .filter((entry: any) => entry.vuuid || entry.vuid || entry.vesselId || entry.id)
    .map((entry: any) => ({
      id: String(entry.vuuid || entry.vuid || entry.vesselId || entry.id),
      vuuid: String(entry.vuuid || entry.vuid || entry.vesselId || entry.id),
      name: String(entry.vessel || entry.vesselName || entry.name || ''),
      code: String(entry.vuuid || entry.vuid || entry.vesselId || entry.code || entry.id),
      imoNumber: String(entry.imoNumber || entry.imo_number || ''),
      vesselType: String(entry.vesselType || entry.vessel_type || ''),
    }));

  return { data: vessels, isLoading, error };
}

export function useVesselOptions() {
  const { data: vessels = [], isLoading, error } = useVessels();
  
  const options = vessels.map(v => ({
    value: v.id,
    label: v.name || v.id
  }));
  
  return { options, isLoading, error, vessels };
}
