import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useVessels } from '@/hooks/useVessels';
import { useUIRole } from '@/contexts/UIRoleContext';

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
  const [vesselId, setVesselIdState] = useState<string>('');

  const { data: vesselData = [], isLoading } = useVessels();
  const { uiRole, isSailAdmin, isClientAdmin } = useUIRole();

  const userTouchedRef = useRef(false);
  const lastAppliedRoleRef = useRef<string | null>(null);

  const vessels: Vessel[] = vesselData
    .filter((entry: any) => entry.id)
    .map((entry: any) => ({
      id: String(entry.id),
      name: String(entry.name || ''),
      code: String(entry.code || entry.id),
    }));

  useEffect(() => {
    if (uiRole === null) return;

    const adminDefaultsToAll = isSailAdmin || isClientAdmin;
    const roleChanged = lastAppliedRoleRef.current !== uiRole;

    if (adminDefaultsToAll) {
      if (roleChanged || !userTouchedRef.current) {
        if (vesselId !== 'all') {
          console.log(`🚢 Forcing "All Vessels" default for admin role (${uiRole})`);
          setVesselIdState('all');
        }
        if (roleChanged) {
          userTouchedRef.current = false;
        }
        lastAppliedRoleRef.current = uiRole;
      }
      return;
    }

    if (vessels.length === 0) return;

    const isAllVessels = vesselId === 'all';
    const vesselExists = isAllVessels || vessels.some(v => v.id === vesselId);

    if (!vesselId || !vesselExists || (isAllVessels && roleChanged)) {
      const stored = localStorage.getItem('selectedVesselId');
      let target: string;
      if (stored && stored !== 'all' && vessels.some(v => v.id === stored)) {
        target = stored;
        console.log(`🚢 Restoring stored vessel: ${stored} for role ${uiRole}`);
      } else {
        const firstVessel = vessels[0];
        target = firstVessel.id;
        console.log(`🚢 Auto-selecting first vessel: ${firstVessel.id} (${firstVessel.name}) for role ${uiRole}`);
      }
      setVesselIdState(target);
      if (roleChanged) {
        userTouchedRef.current = false;
      }
    }
    lastAppliedRoleRef.current = uiRole;
  }, [vessels, vesselId, uiRole, isSailAdmin, isClientAdmin]);

  useEffect(() => {
    if (!vesselId) return;
    if (isSailAdmin || isClientAdmin) {
      return;
    }
    localStorage.setItem('selectedVesselId', vesselId);
  }, [vesselId, isSailAdmin, isClientAdmin]);

  const setVesselId = (id: string) => {
    userTouchedRef.current = true;
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
