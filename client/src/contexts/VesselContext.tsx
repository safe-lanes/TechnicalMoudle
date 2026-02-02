import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useVessels } from '@/hooks/useVessels';

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

  const { data: vesselData = [], isLoading } = useVessels();
  
  const vessels: Vessel[] = vesselData
    .filter((entry: any) => entry.id)
    .map((entry: any) => ({
      id: String(entry.id),
      name: String(entry.name || ''),
      code: String(entry.code || entry.id),
    }));

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
