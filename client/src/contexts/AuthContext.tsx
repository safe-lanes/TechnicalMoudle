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
import { setActiveRank } from "@/lib/activeRank";
import { queryClient, apiRequest } from "@/lib/queryClient";

function resolveProfileName(profile: Record<string, any>): {
  fullName: string | null;
  username: string | null;
  userUuid: string | null;
} {
  const fullName =
    profile.fullName ||
    profile.full_name ||
    profile.name ||
    profile.displayName ||
    profile.display_name ||
    [profile.firstname, profile.lastname].filter(Boolean).join(" ") ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.userName ||
    null;
  const username =
    profile.username ||
    profile.user_name ||
    profile.userName ||
    profile.login ||
    null;
  const userUuid =
    profile.userId ||
    profile.user_id ||
    profile.uuid ||
    profile.userUuid ||
    null;
  return { fullName, username, userUuid };
}

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
  rank_name: "Master",
  userUuid: "00000000-0000-0000-0000-000000000001",
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

function invalidateRankScopedQueries() {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey?.[0];
      return (
        typeof key === "string" &&
        key.startsWith("/technical/api/scoped-operation-data")
      );
    },
  });
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [userType, setUserType] = useState<UIRole | null>(null);

  useEffect(() => {
    let resolvedUser: PublicUser | null = null;
    let resolvedUserType: UIRole | null = null;

    const encryptedProfile = secureGetItem<Record<string, any>>("userProfile");
    const encryptedUserType = secureGetItem<string>("userType");

    if (encryptedProfile && import.meta.env.DEV) {
      console.log(
        "[AuthContext] userProfile keys:",
        Object.keys(encryptedProfile),
      );
      console.log("[AuthContext] name-related fields:", {
        fullName: encryptedProfile.fullName,
        full_name: encryptedProfile.full_name,
        name: encryptedProfile.name,
        displayName: encryptedProfile.displayName,
        userName: encryptedProfile.userName,
        username: encryptedProfile.username,
        firstname: encryptedProfile.firstname,
        lastname: encryptedProfile.lastname,
        firstName: encryptedProfile.firstName,
        lastName: encryptedProfile.lastName,
        first_name: encryptedProfile.first_name,
        last_name: encryptedProfile.last_name,
        userId: encryptedProfile.userId,
      });
    }

    if (encryptedUserType && encryptedProfile?.role) {
      resolvedUserType = mapLoggedRoleToUIRole(
        encryptedUserType,
        encryptedProfile.role,
      );

      const role = (encryptedProfile.role as UserRole) || "Office";
      const resolved = resolveProfileName(encryptedProfile);
      resolvedUser = {
        id: encryptedProfile.id || 0,
        username: resolved.username || "user",
        fullName: resolved.fullName || resolved.username || "User",
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

        rank_name:
          encryptedProfile.rank_name || encryptedProfile.rankName || null,
        userUuid: resolved.userUuid || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      const plainUserType = localStorage.getItem("userType");
      let plainProfile: Record<string, any> | null = null;
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) plainProfile = JSON.parse(raw);
      } catch {
        plainProfile = null;
      }

      if (plainProfile && import.meta.env.DEV) {
        console.log(
          "[AuthContext] plain userProfile keys:",
          Object.keys(plainProfile),
        );
        console.log("[AuthContext] plain name-related fields:", {
          fullName: plainProfile.fullName,
          full_name: plainProfile.full_name,
          name: plainProfile.name,
          displayName: plainProfile.displayName,
          userName: plainProfile.userName,
          username: plainProfile.username,
          firstname: plainProfile.firstname,
          lastname: plainProfile.lastname,
          firstName: plainProfile.firstName,
          lastName: plainProfile.lastName,
          first_name: plainProfile.first_name,
          last_name: plainProfile.last_name,
          userId: plainProfile.userId,
        });
      }

      if (plainUserType && plainProfile?.role) {
        resolvedUserType = mapLoggedRoleToUIRole(
          plainUserType,
          plainProfile.role,
        );

        const role = (plainProfile.role as UserRole) || "Office";
        const resolved = resolveProfileName(plainProfile);
        resolvedUser = {
          id: plainProfile.id || 0,
          username: resolved.username || "user",
          fullName: resolved.fullName || resolved.username || "User",
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
          rank_name: plainProfile.rank_name || plainProfile.rankName || null,
          userUuid: resolved.userUuid || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    if (!resolvedUser) {
      resolvedUser = DEFAULT_USER;
      resolvedUserType = mapLoggedRoleToUIRole(
        DEFAULT_USER.userType,
        DEFAULT_USER.role,
      );
    }

    setCurrentUser(resolvedUser);
    setUserType(resolvedUserType);
    const hydratedRankChanged = setActiveRank(resolvedUser?.rank_name ?? null);
    if (hydratedRankChanged) {
      invalidateRankScopedQueries();
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
      rank_name: user.rank_name,
      userUuid: user.userUuid,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const derivedUIType = mapLoggedRoleToUIRole(user.userType, user.role);

    setCurrentUser(sanitizedUser);
    setUserType(derivedUIType);
    const rankChanged = setActiveRank(sanitizedUser.rank_name ?? null);
    if (rankChanged) {
      invalidateRankScopedQueries();
    }
  };

  const logout = () => {
    // Best-effort Shipskart SSO logout (Purchasing module). Per the
    // integration guide we notify Shipskart BEFORE clearing the local
    // session, but it must NEVER block local logout — fire-and-forget,
    // errors are logged only. The backend endpoint is idempotent.
    void (async () => {
      try {
        await apiRequest("POST", "/technical/api/shipskart/sso/logout");
      } catch (err) {
        console.error("[Shipskart] logout call failed (non-blocking):", err);
      }
    })();

    setCurrentUser(null);
    setUserType(null);
    const rankChanged = setActiveRank(null);
    if (rankChanged) {
      invalidateRankScopedQueries();
    }
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
