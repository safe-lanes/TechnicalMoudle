import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { mapLoggedRoleToUIRole } from "@shared/uiRoles";
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
    if (!currentUser) {
      setUIRoleState(null);
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
      setUIRoleState(mapLoggedRoleToUIRole(plainUserType, plainProfileRole));
      return;
    }

    setUIRoleState(mapLoggedRoleToUIRole(currentUser.userType, currentUser.role));
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
