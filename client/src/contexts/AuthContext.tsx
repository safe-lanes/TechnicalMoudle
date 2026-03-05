import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { PublicUser, UserRole } from "@shared/schema";
import type { UIRole } from "@shared/uiRoles";
import { secureSetItem, secureGetItem, clearAllSecureItems } from "@/utils/secureStorage";
import { analyzeLocalStorage } from "@/utils/localStorageAnalyzer";
import {
  generateRoleAccessData,
  getRoleAccessData,
  setRoleAccessData,
  canAccessModule as checkModuleAccess,
  canPerformAction as checkAction,
  type RoleAccessData,
  type ModulePermissions,
} from "@/utils/roleAccessData";

const ROLE_TO_UI_TYPE: Record<UserRole, UIRole> = {
  Ship: "Vessel",
  Office: "Client_Admin",
  "PMS Admin": "Sail_Admin",
};

interface AuthContextType {
  currentUser: PublicUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isShipUser: boolean;
  isOfficeUser: boolean;
  isPMSAdmin: boolean;
  canViewDocument: (shipViewable: boolean) => boolean;
  canDownloadDocument: (shipDownloadable: boolean) => boolean;
  canModifyData: () => boolean;
  canApproveChanges: () => boolean;
  roleAccessData: RoleAccessData | null;
  canAccessModule: (moduleName: keyof RoleAccessData["modules"], permission: keyof ModulePermissions) => boolean;
  canPerformAction: (actionName: keyof RoleAccessData["actions"]) => boolean;
  userType: UIRole | null;
  login: (user: PublicUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [roleAccessData, setRoleAccessDataState] = useState<RoleAccessData | null>(null);
  const [userType, setUserType] = useState<UIRole | null>(null);

  const initializeAuth = (user: PublicUser) => {
    const derivedUIType = ROLE_TO_UI_TYPE[user.role] || "Vessel";
    const accessData = generateRoleAccessData(user.role);

    secureSetItem("userProfile", user);
    secureSetItem("userRole", user.role);
    secureSetItem("userType", derivedUIType);
    secureSetItem("credentials", { sessionId: crypto.randomUUID(), createdAt: Date.now() });
    setRoleAccessData(accessData);

    setCurrentUser(user);
    setRoleAccessDataState(accessData);
    setUserType(derivedUIType);
  };

  useEffect(() => {
    const storedProfile = secureGetItem<PublicUser>("userProfile");

    if (storedProfile) {
      setCurrentUser(storedProfile);

      const storedAccessData = getRoleAccessData();
      if (storedAccessData) {
        setRoleAccessDataState(storedAccessData);
      }

      const storedType = secureGetItem<UIRole>("userType");
      if (storedType) {
        setUserType(storedType);
      }
    } else {
      const defaultUser: PublicUser = {
        id: 1,
        username: "munawer.modak",
        fullName: "Munawer A. Modak",
        email: "ayush.agrawal@safe-lanes.com",
        role: "Office",
        vesselId: null,
        department: null,
        isActive: true,
        crewDesignation: "Marine Manager",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      initializeAuth(defaultUser);
    }

    try {
      analyzeLocalStorage();
    } catch (error) {
      console.error("LocalStorage analysis failed (non-blocking):", error);
    }
  }, []);

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!currentUser) return false;
    if (Array.isArray(role)) {
      return role.includes(currentUser.role);
    }
    return currentUser.role === role;
  };

  const isShipUser = currentUser?.role === "Ship";
  const isOfficeUser = currentUser?.role === "Office";
  const isPMSAdmin = currentUser?.role === "PMS Admin";

  const canViewDocument = (shipViewable: boolean): boolean => {
    if (isPMSAdmin || isOfficeUser) return true;
    if (isShipUser) return shipViewable;
    return false;
  };

  const canDownloadDocument = (shipDownloadable: boolean): boolean => {
    if (isPMSAdmin || isOfficeUser) return true;
    if (isShipUser) return shipDownloadable;
    return false;
  };

  const canModifyData = (): boolean => {
    return isPMSAdmin || isOfficeUser;
  };

  const canApproveChanges = (): boolean => {
    return isPMSAdmin || isOfficeUser;
  };

  const login = (user: PublicUser) => {
    const sanitizedUser: PublicUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      vesselId: user.vesselId,
      department: user.department,
      isActive: user.isActive,
      crewDesignation: user.crewDesignation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    initializeAuth(sanitizedUser);
  };

  const logout = () => {
    clearAllSecureItems();
    setCurrentUser(null);
    setRoleAccessDataState(null);
    setUserType(null);
  };

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    hasRole,
    isShipUser,
    isOfficeUser,
    isPMSAdmin,
    canViewDocument,
    canDownloadDocument,
    canModifyData,
    canApproveChanges,
    roleAccessData,
    canAccessModule: (moduleName, permission) => checkModuleAccess(moduleName, permission, roleAccessData),
    canPerformAction: (actionName) => checkAction(actionName, roleAccessData),
    userType,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
