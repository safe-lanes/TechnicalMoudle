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
import { secureGetItem } from "@/utils/secureStorage";
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
  role: "Sail Admin",
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
    let resolvedPath = "NONE";
    const isDev = import.meta.env.DEV;

    if (isDev) console.log("[AuthContext] ── Role Resolution Start ──");

    const rawUserProfile = localStorage.getItem("userProfile");
    const rawUserType = localStorage.getItem("userType");
    if (isDev) {
      console.log("[AuthContext] Raw localStorage userProfile exists:", rawUserProfile !== null, rawUserProfile ? `(length: ${rawUserProfile.length}, starts: ${rawUserProfile.substring(0, 20)}...)` : "");
      console.log("[AuthContext] Raw localStorage userType exists:", rawUserType !== null, rawUserType ? `(value: ${rawUserType.substring(0, 30)})` : "");
    }

    const encryptedProfile = secureGetItem<Record<string, any>>("userProfile");
    const encryptedUserType = secureGetItem<string>("userType");
    if (isDev) {
      console.log("[AuthContext] secureGetItem userProfile:", encryptedProfile ? `{id: ${encryptedProfile.id}, role: ${encryptedProfile.role}}` : "null");
      console.log("[AuthContext] secureGetItem userType:", encryptedUserType);
    }

    if (encryptedUserType && encryptedProfile?.role) {
      resolvedPath = "ENCRYPTED";
      resolvedUserType = mapLoggedRoleToUIRole(encryptedUserType, encryptedProfile.role);
      if (isDev) console.log("[AuthContext] ENCRYPTED path → mapLoggedRoleToUIRole(", encryptedUserType, ",", encryptedProfile.role, ") =", resolvedUserType);

      const role = (encryptedProfile.role as UserRole) || "Office";
      resolvedUser = {
        id: encryptedProfile.id || 0,
        username: encryptedProfile.username || "user",
        fullName: encryptedProfile.fullName || encryptedProfile.name || "User",
        email: encryptedProfile.email || null,
        role: role,
        userType:
          encryptedUserType === "Office" || encryptedUserType === "Ship"
            ? encryptedUserType
            : undefined,
        vesselId: encryptedProfile.vesselId || null,
        department: encryptedProfile.department || null,
        isActive: true,
        crewDesignation: encryptedProfile.crewDesignation || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      if (isDev) console.log("[AuthContext] Encrypted path SKIPPED (encryptedUserType:", encryptedUserType, ", encryptedProfile?.role:", encryptedProfile?.role, ")");

      if (rawUserProfile && !encryptedProfile) {
        if (isDev) console.log("[AuthContext] ⚠ Raw data EXISTS but decryption FAILED — likely VITE_STORAGE_SECRET key mismatch");
      }

      const plainUserType = localStorage.getItem("userType");
      let plainProfile: Record<string, any> | null = null;
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) plainProfile = JSON.parse(raw);
      } catch {
        if (isDev) console.log("[AuthContext] Plain path: JSON.parse of userProfile FAILED (likely encrypted data)");
        plainProfile = null;
      }

      if (isDev) console.log("[AuthContext] Plain path: userType=", plainUserType, ", profile?.role=", plainProfile?.role);

      if (plainUserType && plainProfile?.role) {
        resolvedPath = "PLAIN";
        resolvedUserType = mapLoggedRoleToUIRole(plainUserType, plainProfile.role);
        if (isDev) console.log("[AuthContext] PLAIN path → mapLoggedRoleToUIRole(", plainUserType, ",", plainProfile.role, ") =", resolvedUserType);

        const role = (plainProfile.role as UserRole) || "Office";
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
        if (isDev) console.log("[AuthContext] Plain path SKIPPED (plainUserType:", plainUserType, ", plainProfile?.role:", plainProfile?.role, ")");
      }
    }

    if (!resolvedUser) {
      resolvedPath = "DEFAULT_USER";
      resolvedUser = DEFAULT_USER;
      resolvedUserType = mapLoggedRoleToUIRole(DEFAULT_USER.userType, DEFAULT_USER.role);
      if (isDev) console.log("[AuthContext] DEFAULT_USER fallback → mapLoggedRoleToUIRole(", DEFAULT_USER.userType, ",", DEFAULT_USER.role, ") =", resolvedUserType);
    }

    if (isDev) {
      console.log("[AuthContext] ── Resolution Complete ──");
      console.log("[AuthContext] Path used:", resolvedPath);
      console.log("[AuthContext] Resolved user:", { id: resolvedUser.id, role: resolvedUser.role, userType: resolvedUser.userType });
      console.log("[AuthContext] Resolved UIRole:", resolvedUserType);
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
