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
import { extractRole, extractProfileFields } from "@/utils/profileExtractor";

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
      console.log("[AuthContext] secureGetItem userType:", encryptedUserType);
      if (encryptedProfile) {
        const topKeys = Object.keys(encryptedProfile);
        console.log("[AuthContext] secureGetItem userProfile TOP-LEVEL KEYS:", topKeys);
        for (const key of topKeys) {
          const val = encryptedProfile[key];
          if (val && typeof val === "object" && !Array.isArray(val)) {
            const subKeys = Object.keys(val).slice(0, 15);
            console.log(`[AuthContext]   └─ ${key} (object) subkeys:`, subKeys);
            if (val.role) console.log(`[AuthContext]   ★ FOUND role at profile.${key}.role =`, val.role);
            if (val.id) console.log(`[AuthContext]   ★ FOUND id at profile.${key}.id =`, val.id);
          } else if (key === "role") {
            console.log(`[AuthContext]   ★ FOUND role at profile.role =`, val);
          } else if (key === "id") {
            console.log(`[AuthContext]   ★ FOUND id at profile.id =`, val);
          }
        }
      } else {
        console.log("[AuthContext] secureGetItem userProfile: null");
      }
    }

    const encryptedRole = extractRole(encryptedProfile);
    if (isDev) console.log("[AuthContext] extractRole from decrypted profile:", encryptedRole);

    if (encryptedUserType && encryptedRole) {
      resolvedPath = "ENCRYPTED";
      resolvedUserType = mapLoggedRoleToUIRole(encryptedUserType, encryptedRole);
      if (isDev) console.log("[AuthContext] ENCRYPTED path → mapLoggedRoleToUIRole(", encryptedUserType, ",", encryptedRole, ") =", resolvedUserType);

      const fields = extractProfileFields(encryptedProfile);
      resolvedUser = {
        id: fields.id,
        username: fields.username,
        fullName: fields.fullName,
        email: fields.email,
        role: (encryptedRole as UserRole) || "Office",
        userType:
          encryptedUserType === "Office" || encryptedUserType === "Ship"
            ? encryptedUserType
            : undefined,
        vesselId: fields.vesselId,
        department: fields.department,
        isActive: true,
        crewDesignation: fields.crewDesignation,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      if (isDev) console.log("[AuthContext] Encrypted path SKIPPED (encryptedUserType:", encryptedUserType, ", extractedRole:", encryptedRole, ")");

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

      const plainRole = extractRole(plainProfile);
      if (isDev) console.log("[AuthContext] Plain path: userType=", plainUserType, ", extractedRole=", plainRole);

      if (plainUserType && plainRole) {
        resolvedPath = "PLAIN";
        resolvedUserType = mapLoggedRoleToUIRole(plainUserType, plainRole);
        if (isDev) console.log("[AuthContext] PLAIN path → mapLoggedRoleToUIRole(", plainUserType, ",", plainRole, ") =", resolvedUserType);

        const fields = extractProfileFields(plainProfile);
        resolvedUser = {
          id: fields.id,
          username: fields.username,
          fullName: fields.fullName,
          email: fields.email,
          role: (plainRole as UserRole) || "Office",
          userType:
            plainUserType === "Office" || plainUserType === "Ship"
              ? plainUserType
              : undefined,
          vesselId: fields.vesselId,
          department: fields.department,
          isActive: true,
          crewDesignation: fields.crewDesignation,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        if (isDev) console.log("[AuthContext] Plain path SKIPPED (plainUserType:", plainUserType, ", extractedRole:", plainRole, ")");
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
