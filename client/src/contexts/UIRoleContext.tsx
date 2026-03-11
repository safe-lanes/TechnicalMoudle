import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { UI_ROLES, mapLoggedRoleToUIRole } from "@shared/uiRoles";
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

const CURRENT_USER_ROLE_TO_UI: Record<string, UIRole> = {
  "Ship": "Vessel",
  "Office": "Client_Admin",
  "PMS Admin": "Sail_Admin",
  "Sail Admin": "Sail_Admin",
  "Super Admin": "Client_Admin",
  "Vessel Admin": "Head_of_Dept",
  "Vessel User": "Vessel",
  "Admin": "Client_Admin",
  "User": "Client_Admin",
  "Vessel Management": "Head_of_Dept",
  "Vessel User 2": "Vessel",
  "Vessel User 3": "Vessel",
  "Vessel User 4": "Vessel",
  "External 1": "Client_Admin",
  "External 2": "Client_Admin",
  "External 3": "Client_Admin",
  "External 4": "Client_Admin",
  "External 5": "Client_Admin",
};

interface UIRoleProviderProps {
  children: ReactNode;
}

export function UIRoleProvider({ children }: UIRoleProviderProps) {
  const { currentUser } = useAuth();
  const [uiRole, setUIRoleState] = useState<UIRole | null>(null);

  useEffect(() => {
    if (currentUser?.role) {
      const mapped = CURRENT_USER_ROLE_TO_UI[currentUser.role];
      if (mapped) {
        setUIRoleState(mapped);
        return;
      }
    }

    const plainUserType = localStorage.getItem("userType");
    let plainProfile: { role?: string } | null = null;
    try {
      const raw = localStorage.getItem("userProfile");
      if (raw) plainProfile = JSON.parse(raw);
    } catch {
      plainProfile = null;
    }

    if (plainUserType && plainProfile?.role) {
      setUIRoleState(mapLoggedRoleToUIRole(plainUserType, plainProfile.role));
      return;
    }

    const storedRole = secureGetItem<UIRole>("userType");
    if (storedRole && UI_ROLES.includes(storedRole)) {
      setUIRoleState(storedRole);
      return;
    }
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

export function useUIRole() {
  const context = useContext(UIRoleContext);
  if (context === undefined) {
    throw new Error("useUIRole must be used within a UIRoleProvider");
  }
  return context;
}
