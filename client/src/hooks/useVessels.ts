import { useLocalVessels } from "@/hooks/useExternalMasterData";

interface Vessel {
  id: string;
  name: string;
  code: string;
}

export function useVessels() {
  const { data: vesselEntries = [], isLoading, error } = useLocalVessels();
  
  const vessels: Vessel[] = vesselEntries
    .filter((entry: any) => entry.id)
    .map((entry: any) => ({
      id: String(entry.id),
      name: String(entry.name || ''),
      code: String(entry.code || entry.id),
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
