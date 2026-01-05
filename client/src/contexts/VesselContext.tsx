import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Vessel {
  id: string;
  name: string;
  code: string;
}

interface VesselContextType {
  vesselId: string;
  setVesselId: (id: string) => void;
  isLoading: boolean;
  vessels: Vessel[];
}

export const VesselContext = createContext<VesselContextType | undefined>(undefined);

export const VesselProvider = ({ children }: { children: ReactNode }) => {
  const [vesselId, setVesselIdState] = useState<string>(() => {
    return localStorage.getItem('selectedVesselId') || '';
  });

  const { data: vessels = [], isLoading } = useQuery<Vessel[]>({
    queryKey: ['/technical/api/vessels'],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (vessels.length > 0) {
      const isAllVessels = vesselId === 'all';
      const vesselExists = isAllVessels || vessels.some(v => v.id === vesselId);
      if (!vesselId || !vesselExists) {
        const firstVessel = vessels[0];
        console.log(`🚢 Auto-selecting first vessel: ${firstVessel.id} (${firstVessel.name})${!vesselExists && vesselId ? ` (stored '${vesselId}' not found)` : ''}`);
        setVesselIdState(firstVessel.id);
      }
    }
  }, [vessels, vesselId]);

  useEffect(() => {
    if (vesselId) {
      localStorage.setItem('selectedVesselId', vesselId);
    }
  }, [vesselId]);

  const setVesselId = (id: string) => {
    setVesselIdState(id);
  };

  return (
    <VesselContext.Provider value={{ vesselId, setVesselId, isLoading, vessels }}>
      {children}
    </VesselContext.Provider>
  );
};

export const useVessel = () => {
  const context = useContext(VesselContext);
  if (context === undefined) {
    throw new Error('useVessel must be used within a VesselProvider');
  }
  return context;
};
