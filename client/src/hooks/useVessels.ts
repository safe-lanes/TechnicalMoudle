import { useExternalVessels } from "@/hooks/useExternalMasterData";

interface Vessel {
  id: string;
  name: string;
  code: string;
  imoNumber?: string;
  vesselType?: string;
}

export function useVessels() {
  const { data: vesselEntries = [], isLoading, error } = useExternalVessels();
  
  // Map external Vessel Master data to internal vessel format
  // External API returns: { vuid, vessel, imoNumber, vesselType, ... }
  const vessels: Vessel[] = vesselEntries
    .filter((entry: any) => entry.vuid || entry.vesselId || entry.id)
    .map((entry: any) => ({
      id: String(entry.vuid || entry.vesselId || entry.id),
      name: String(entry.vessel || entry.vesselName || entry.name || ''),
      code: String(entry.vuid || entry.vesselId || entry.id),
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
