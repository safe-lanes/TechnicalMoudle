import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { PublicUser, UserRole } from "@shared/schema";
import type { UIRole } from "@shared/uiRoles";
import { mapLoggedRoleToUIRole } from "@shared/uiRoles";
import { analyzeLocalStorage } from "@/utils/localStorageAnalyzer";

// To test different roles, change role + userType below:
//   role: "Sail Admin",   userType: "Office"  → Dropdown: Sail Admin
//   role: "Super Admin",  userType: "Office"  → Dropdown: Client Admin
//   role: "Vessel Admin", userType: "Ship"    → Dropdown: Head of Dept
//   role: "Vessel User",  userType: "Ship"    → Dropdown: Vessel
const DEFAULT_USER: PublicUser = {
  id: 1,
  username: "munawer.modak",
  fullName: "Munawer A. Modak",
  email: "ayush.agrawal@safe-lanes.com",
  role: "Super Admin",
  userType: "Office",
  vesselId: null,
  department: null,
  isActive: true,
  crewDesignation: "Marine Manager",
  createdAt: new Date(),
  updatedAt: new Date(),
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
  const [userType, setUserType] = useState<UIRole | null>(null);

  useEffect(() => {
    let resolvedUser: PublicUser | null = null;
    let resolvedUserType: UIRole | null = null;

    const plainUserType = localStorage.getItem("userType");
    let plainProfile: Record<string, any> | null = null;
    try {
      const raw = localStorage.getItem("userProfile");
      if (raw) plainProfile = JSON.parse(raw);
    } catch {
      plainProfile = null;
    }

    if (plainUserType && plainProfile?.role) {
      const profileRole = plainProfile.role;
      resolvedUserType = mapLoggedRoleToUIRole(plainUserType, profileRole);

      const role = (profileRole as UserRole) || "Office";
      resolvedUser = {
        id: plainProfile.id || 0,
        username: plainProfile.username || "user",
        fullName: plainProfile.fullName || plainProfile.name || "User",
        email: plainProfile.email || null,
        role: role,
        userType:
          plainUserType === "Office" || plainUserType === "Ship"
            ? plainUserType
            : undefined,
        vesselId: plainProfile.vesselId || null,
        department: plainProfile.department || null,
        isActive: true,
        crewDesignation: plainProfile.crewDesignation || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      resolvedUser = DEFAULT_USER;
      resolvedUserType = mapLoggedRoleToUIRole(
        DEFAULT_USER.userType,
        DEFAULT_USER.role,
      );
    }

    setCurrentUser(resolvedUser);
    setUserType(resolvedUserType);

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

  const isShipUser = currentUser?.userType === "Ship";
  const isOfficeUser = currentUser?.userType === "Office";
  const isPMSAdmin =
    currentUser?.role === "PMS Admin" || currentUser?.role === "Sail Admin";

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
      userType: user.userType,
      vesselId: user.vesselId,
      department: user.department,
      isActive: user.isActive,
      crewDesignation: user.crewDesignation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const derivedUIType = mapLoggedRoleToUIRole(user.userType, user.role);

    setCurrentUser(sanitizedUser);
    setUserType(derivedUIType);
  };

  const logout = () => {
    setCurrentUser(null);
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
