import { useQuery } from "@tanstack/react-query";

interface Vessel {
  id: string;
  name: string;
  code: string;
}

export function useVessels() {
  return useQuery<Vessel[]>({
    queryKey: ['/technical/api/vessels'],
  });
}

export function useVesselOptions() {
  const { data: vessels = [], isLoading, error } = useVessels();
  
  const options = vessels.map(v => ({
    value: v.id,
    label: v.name || v.id
  }));
  
  return { options, isLoading, error, vessels };
}
