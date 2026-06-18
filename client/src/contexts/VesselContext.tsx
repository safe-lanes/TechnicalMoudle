import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { useVessels } from '@/hooks/useVessels';
import { useUIRole } from '@/contexts/UIRoleContext';
import { useAuth } from '@/contexts/AuthContext';

interface Vessel {
  id: string;
  name: string;
  code: string;
}

interface VesselContextType {
  /** A vessel UUID, the 'all' sentinel (entire fleet) or the 'my' sentinel
   * (the logged-in user's assigned mini-fleet). 'all' and 'my' are both
   * aggregate scopes that propagate identically across every module. */
  vesselId: string;
  setVesselId: (id: string) => void;
  isLoading: boolean;
  vessels: Vessel[];
  /** The assigned mini-fleet ids that 'my' aggregates over (from AuthContext). */
  assignedVesselIds: string[];
  /**
   * Scope-aware option list for vessel `<Select>` pickers. When the global
   * scope is 'my' this is narrowed to the assigned mini-fleet; otherwise it is
   * the full vessel list. Use this ONLY to render picker options — keep using
   * `vessels` for id→name lookups so labels resolve for any vessel.
   */
  pickerVessels: Vessel[];
  /** True when scope is 'my' but the user has no assigned vessels — pickers
   * should show an empty-state instead of an empty/unusable dropdown. */
  myVesselsEmpty: boolean;
  isAllVessels: boolean;
  isMyVessels: boolean;
  /**
   * Append vessel scope query params for a fleet-aware read endpoint.
   * - specific vessel  -> vesselId=<uuid>
   * - 'all'            -> vesselId=all
   * - 'my'             -> vesselId=all & vesselIds=<assigned csv> (allow-list).
   *   When the user has no assigned vessels we send a never-matching sentinel
   *   so the backend returns zero rows instead of silently falling back to the
   *   entire fleet.
   */
  applyVesselScope: (params: URLSearchParams) => void;
}

/** Never-matching allow-list sentinel for an empty assigned mini-fleet. */
const EMPTY_MY_SENTINEL = '00000000-0000-0000-0000-000000000000';

export const VesselContext = createContext<VesselContextType | undefined>(undefined);

export const VesselProvider = ({ children }: { children: ReactNode }) => {
  const [vesselId, setVesselIdState] = useState<string>('');

  const { data: vesselData = [], isLoading } = useVessels();
  const { uiRole, isSailAdmin, isClientAdmin } = useUIRole();
  const { myVessels } = useAuth();

  const assignedVesselIds = useMemo(
    () => Array.from(new Set((myVessels || []).map(v => String(v.vesselId)).filter(Boolean))),
    [myVessels]
  );

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
      // Wait for vessel list before defaulting
      if (vessels.length === 0) {
        lastAppliedRoleRef.current = uiRole;
        return;
      }

      if (roleChanged || !userTouchedRef.current) {
        const stored = localStorage.getItem('selectedVesselId');
        let target: string;
        if (stored && (stored === 'all' || stored === 'my' || vessels.some(v => v.id === stored))) {
          target = stored;
          console.log(`🚢 Restoring stored vessel for admin: ${stored} (${uiRole})`);
        } else {
          const firstVessel = vessels[0];
          target = firstVessel.id;
          console.log(`🚢 Defaulting admin to first vessel: ${firstVessel.id} (${firstVessel.name}) for role ${uiRole}`);
        }
        if (vesselId !== target) {
          setVesselIdState(target);
        }
        if (roleChanged) {
          userTouchedRef.current = false;
        }
        lastAppliedRoleRef.current = uiRole;
      }
      return;
    }

    if (vessels.length === 0) return;

    // 'all' (entire fleet) and 'my' (assigned mini-fleet) are both valid
    // aggregate sentinels; never auto-reset them to a single vessel.
    const isAggregateScope = vesselId === 'all' || vesselId === 'my';
    const vesselExists = isAggregateScope || vessels.some(v => v.id === vesselId);

    if (!vesselId || !vesselExists || (isAggregateScope && roleChanged)) {
      const stored = localStorage.getItem('selectedVesselId');
      let target: string;
      if (stored && stored !== 'all' && (stored === 'my' || vessels.some(v => v.id === stored))) {
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
    localStorage.setItem('selectedVesselId', vesselId);
  }, [vesselId]);

  const setVesselId = (id: string) => {
    userTouchedRef.current = true;
    setVesselIdState(id);
  };

  const isAllVessels = vesselId === 'all';
  const isMyVessels = vesselId === 'my';

  // Scope-aware option list for vessel pickers. In 'my' scope, narrow the
  // rendered options to the assigned mini-fleet (mirroring the Dashboard);
  // fall back to a label-only stub if a fleet id is missing from the vessel
  // list. Otherwise expose the full list unchanged.
  const pickerVessels: Vessel[] = isMyVessels
    ? assignedVesselIds.map(
        id => vessels.find(v => v.id === id) || { id, name: id, code: id }
      )
    : vessels;
  const myVesselsEmpty = isMyVessels && assignedVesselIds.length === 0;

  const applyVesselScope = (params: URLSearchParams) => {
    if (isMyVessels) {
      params.set('vesselId', 'all');
      params.set('vesselIds', assignedVesselIds.length ? assignedVesselIds.join(',') : EMPTY_MY_SENTINEL);
    } else {
      params.set('vesselId', vesselId);
    }
  };

  return (
    <VesselContext.Provider
      value={{
        vesselId,
        setVesselId,
        isLoading,
        vessels,
        assignedVesselIds,
        pickerVessels,
        myVesselsEmpty,
        isAllVessels,
        isMyVessels,
        applyVesselScope,
      }}
    >
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
