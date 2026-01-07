import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useExternalVessels } from '@/hooks/useExternalMasterData';

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

// Helper to get Vessel Entry Id from vessel master entry
const getVesselEntryId = (entry: any): string => {
  return String(entry.vuid || entry.vesselId || '');
};

// Helper to get vessel name from vessel master entry
const getVesselName = (entry: any): string => {
  return String(entry.vessel || entry.vesselName || entry.name || '');
};

export const VesselProvider = ({ children }: { children: ReactNode }) => {
  const [vesselId, setVesselIdState] = useState<string>(() => {
    return localStorage.getItem('selectedVesselId') || '';
  });

  const { data: vesselMasterEntries = [], isLoading } = useExternalVessels();
  
  // Transform Vessel Master entries to standard Vessel format
  const vessels: Vessel[] = vesselMasterEntries
    .filter((entry: any) => getVesselEntryId(entry))
    .map((entry: any) => ({
      id: getVesselEntryId(entry),
      name: getVesselName(entry),
      code: getVesselEntryId(entry),
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
