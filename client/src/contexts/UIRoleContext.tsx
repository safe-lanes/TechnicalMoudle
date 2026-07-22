import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { secureGetItem } from "@/utils/secureStorage";
import { useAuth } from "@/contexts/AuthContext";
import { useViewModeResolution } from "@/hooks/useViewModeResolution";
import { isReplit } from "@/lib/env";

const DEV_ROLE_TO_STORAGE: Record<UIRole, { userType: string; role: string }> = {
  Sail_Admin:         { userType: "Office", role: "Sail Admin" },
  Client_Admin:       { userType: "Office", role: "Client Admin" },
  Tech_Superintendent:{ userType: "Office", role: "Admin" },
  Head_of_Dept:       { userType: "Ship",   role: "Vessel Admin" },
  Vessel:             { userType: "Ship",   role: "Vessel User" },
  External:           { userType: "Office", role: "External 10" },
};

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

    // Same precedence as before Task #324: encrypted storage → plain storage →
    // currentUser. Only the MAPPING moved server-side (fail-closed DB lookup
    // via the shared useViewModeResolution hook, replacing mapLoggedRoleToUIRole).
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

    const plainUserType = localStorage.getItem("userType");
    let plainProfileRole: string | null = null;
    try {
      const raw = localStorage.getItem("userProfile");
      if (raw) {
        const parsed = JSON.parse(raw);
        plainProfileRole = parsed?.role || null;
      }
    } catch {
      plainProfileRole = null;
    }

    if (plainUserType && plainProfileRole) {
      setInputs({ userType: plainUserType, role: plainProfileRole });
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
    if (!isReplit()) return;
    const storage = DEV_ROLE_TO_STORAGE[role];
    localStorage.setItem("userType", storage.userType);
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem("userProfile") || "{}"); } catch { return {}; }
    })();
    localStorage.setItem("userProfile", JSON.stringify({ ...existing, role: storage.role }));
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
