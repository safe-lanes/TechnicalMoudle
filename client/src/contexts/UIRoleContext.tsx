import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { secureGetItem } from "@/utils/secureStorage";
import { useAuth } from "@/contexts/AuthContext";
import { useViewModeResolution } from "@/hooks/useViewModeResolution";
import { isReplit } from "@/lib/env";

interface UIRoleContextType {
  uiRole: UIRole | null;
  setUIRole: (role: UIRole) => void;
  isSailAdmin: boolean;
  isClientAdmin: boolean;
  isTechSuperintendent: boolean;
  isHeadOfDept: boolean;
  isVessel: boolean;
  isExternal: boolean;
}

const UIRoleContext = createContext<UIRoleContextType | undefined>(undefined);

interface UIRoleProviderProps {
  children: ReactNode;
}

interface ResolutionInputs {
  userType: string | null;
  role: string | null;
}

export function UIRoleProvider({ children }: UIRoleProviderProps) {
  const { currentUser } = useAuth();
  const [inputs, setInputs] = useState<ResolutionInputs>({ userType: null, role: null });
  // DEV-only role switcher override — wins over server resolution so switching
  // to synthetic storage roles (e.g. "Client Admin") never hits ROLE_NOT_FOUND.
  const [devOverride, setDevOverride] = useState<UIRole | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setInputs({ userType: null, role: null });
      setDevOverride(null);
      return;
    }

    // Precedence: ENCRYPTED storage → currentUser. Plain-text localStorage is
    // untrusted (attacker-editable) and is never read. The MAPPING itself is
    // server-side (fail-closed DB lookup via the shared useViewModeResolution hook).
    const encryptedUserType = secureGetItem<string>("userType");
    let encryptedProfileRole: string | null = null;
    try {
      const encryptedProfile = secureGetItem<Record<string, any>>("userProfile");
      encryptedProfileRole = encryptedProfile?.role || null;
    } catch {
      encryptedProfileRole = null;
    }

    if (encryptedUserType && encryptedProfileRole) {
      setInputs({ userType: encryptedUserType, role: encryptedProfileRole });
      return;
    }

    setInputs({
      userType: currentUser.userType ?? null,
      role: currentUser.role ?? null,
    });
  }, [currentUser]);

  const resolution = useViewModeResolution(inputs.userType, inputs.role);
  const uiRole = devOverride ?? resolution.uiRole;

  const setUIRole = (role: UIRole) => {
    // Dev-only switching, restricted to the Replit workspace (VITE_APP_ENV=replit).
    // Memory-only override — NEVER writes to localStorage, so a stale synthetic
    // role can never poison a later session (the "Client Admin" reload lockout).
    // Trade-off: the picked role resets to the default user on page reload.
    if (!isReplit()) return;
    setDevOverride(role);
  };

  const value: UIRoleContextType = {
    uiRole,
    setUIRole,
    isSailAdmin: uiRole === "Sail_Admin",
    isClientAdmin: uiRole === "Client_Admin",
    isTechSuperintendent: uiRole === "Tech_Superintendent",
    isHeadOfDept: uiRole === "Head_of_Dept",
    isVessel: uiRole === "Vessel",
    isExternal: uiRole === "External",
  };

  return (
    <UIRoleContext.Provider value={value}>{children}</UIRoleContext.Provider>
  );
}

const FALLBACK_CONTEXT: UIRoleContextType = {
  uiRole: null,
  setUIRole: () => {},
  isSailAdmin: false,
  isClientAdmin: false,
  isTechSuperintendent: false,
  isHeadOfDept: false,
  isVessel: false,
  isExternal: false,
};

export function useUIRole() {
  const context = useContext(UIRoleContext);
  if (context === undefined) {
    if (import.meta.env.DEV && import.meta.hot) {
      return FALLBACK_CONTEXT;
    }
    throw new Error("useUIRole must be used within a UIRoleProvider");
  }
  return context;
}
