import { useExternalVessels } from "@/hooks/useExternalMasterData";

interface Vessel {
  id: string;
  name: string;
  code: string;
}

// Helper to get Vessel Entry Id from vessel master entry
const getVesselEntryId = (entry: any): string => {
  return String(entry.vuid || entry.vesselId || '');
};

// Helper to get vessel name from vessel master entry
const getVesselName = (entry: any): string => {
  return String(entry.vessel || entry.vesselName || entry.name || '');
};

export function useVessels() {
  const { data: vesselMasterEntries = [], isLoading, error } = useExternalVessels();
  
  // Transform Vessel Master entries to standard Vessel format
  const vessels: Vessel[] = vesselMasterEntries
    .filter((entry: any) => getVesselEntryId(entry))
    .map((entry: any) => ({
      id: getVesselEntryId(entry),
      name: getVesselName(entry),
      code: getVesselEntryId(entry),
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
