import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UIRole } from "@shared/uiRoles";
import { UI_ROLES } from "@shared/uiRoles";

interface UIRoleContextType {
  uiRole: UIRole;
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

const UI_ROLE_STORAGE_KEY = "sail_ui_role";

export function UIRoleProvider({ children }: UIRoleProviderProps) {
  const [uiRole, setUIRoleState] = useState<UIRole>("Client_Admin");

  useEffect(() => {
    const storedRole = localStorage.getItem(UI_ROLE_STORAGE_KEY);
    if (storedRole && UI_ROLES.includes(storedRole as UIRole)) {
      setUIRoleState(storedRole as UIRole);
    }
  }, []);

  const setUIRole = (role: UIRole) => {
    setUIRoleState(role);
    localStorage.setItem(UI_ROLE_STORAGE_KEY, role);
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
