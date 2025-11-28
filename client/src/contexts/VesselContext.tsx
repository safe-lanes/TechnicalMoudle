import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface VesselContextType {
  vesselId: string;
  setVesselId: (id: string) => void;
}

const VesselContext = createContext<VesselContextType | undefined>(undefined);

export const VesselProvider = ({ children }: { children: ReactNode }) => {
  const [vesselId, setVesselIdState] = useState<string>(() => {
    const stored = localStorage.getItem('selectedVesselId');
    return stored || 'V0001'; // Default to V0001 which matches actual vessel data
  });

  useEffect(() => {
    localStorage.setItem('selectedVesselId', vesselId);
  }, [vesselId]);

  const setVesselId = (id: string) => {
    setVesselIdState(id);
  };

  return (
    <VesselContext.Provider value={{ vesselId, setVesselId }}>
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
