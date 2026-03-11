import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { mapLoggedRoleToUIRole } from "@shared/uiRoles";
import { secureGetItem } from "@/utils/secureStorage";
import { useAuth } from "@/contexts/AuthContext";

interface UIRoleContextType {
  uiRole: UIRole | null;
  setUIRole: (role: UIRole) => void;
  isSailAdmin: boolean;
  isClientAdmin: boolean;
  isHeadOfDept: boolean;
  isVessel: boolean;
}

const UIRoleContext = createContext<UIRoleContextType | undefined>(undefined);

interface UIRoleProviderProps {
  children: ReactNode;
}

export function UIRoleProvider({ children }: UIRoleProviderProps) {
  const { currentUser } = useAuth();
  const [uiRole, setUIRoleState] = useState<UIRole | null>(null);

  useEffect(() => {
    const isDev = import.meta.env.DEV;

    if (!currentUser) {
      if (isDev) console.log("[UIRoleContext] No currentUser, setting uiRole to null");
      setUIRoleState(null);
      return;
    }

    if (isDev) {
      console.log("[UIRoleContext] ── UIRole Resolution Start ──");
      console.log("[UIRoleContext] currentUser from AuthContext:", { role: currentUser.role, userType: currentUser.userType });
    }

    const encryptedUserType = secureGetItem<string>("userType");
    let encryptedProfileRole: string | null = null;
    try {
      const encryptedProfile = secureGetItem<Record<string, any>>("userProfile");
      encryptedProfileRole = encryptedProfile?.role || null;
    } catch {
      encryptedProfileRole = null;
    }

    if (isDev) console.log("[UIRoleContext] secureGetItem: userType=", encryptedUserType, ", profileRole=", encryptedProfileRole);

    if (encryptedUserType && encryptedProfileRole) {
      const result = mapLoggedRoleToUIRole(encryptedUserType, encryptedProfileRole);
      if (isDev) console.log("[UIRoleContext] ENCRYPTED path → mapLoggedRoleToUIRole(", encryptedUserType, ",", encryptedProfileRole, ") =", result);
      setUIRoleState(result);
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
      if (isDev) console.log("[UIRoleContext] Plain JSON.parse failed (likely encrypted)");
      plainProfileRole = null;
    }

    if (isDev) console.log("[UIRoleContext] Plain path: userType=", plainUserType, ", profileRole=", plainProfileRole);

    if (plainUserType && plainProfileRole) {
      const result = mapLoggedRoleToUIRole(plainUserType, plainProfileRole);
      if (isDev) console.log("[UIRoleContext] PLAIN path → mapLoggedRoleToUIRole(", plainUserType, ",", plainProfileRole, ") =", result);
      setUIRoleState(result);
      return;
    }

    const fallbackResult = mapLoggedRoleToUIRole(currentUser.userType, currentUser.role);
    if (isDev) console.log("[UIRoleContext] FALLBACK (currentUser) → mapLoggedRoleToUIRole(", currentUser.userType, ",", currentUser.role, ") =", fallbackResult);
    setUIRoleState(fallbackResult);
  }, [currentUser]);

  const setUIRole = (_role: UIRole) => {
  };

  const value: UIRoleContextType = {
    uiRole,
    setUIRole,
    isSailAdmin: uiRole === "Sail_Admin",
    isClientAdmin: uiRole === "Client_Admin",
    isHeadOfDept: uiRole === "Head_of_Dept",
    isVessel: uiRole === "Vessel",
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
  isHeadOfDept: false,
  isVessel: false,
};

export function useUIRole() {
  const context = useContext(UIRoleContext);
  if (context === undefined) {
    if (import.meta.env.DEV && import.meta.hot) {
      console.warn("[useUIRole] Called outside UIRoleProvider (likely HMR). Using safe fallback.");
      return FALLBACK_CONTEXT;
    }
    throw new Error("useUIRole must be used within a UIRoleProvider");
  }
  return context;
}
