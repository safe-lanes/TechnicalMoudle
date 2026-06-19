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
import { secureGetItem, secureClear } from "@/utils/secureStorage";
import { analyzeLocalStorage } from "@/utils/localStorageAnalyzer";
import {
  setActiveRank,
  setActiveIdentity,
  type ActiveIdentity,
} from "@/lib/activeRank";
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

/**
 * Read the standalone `domain` key from localStorage. It is stored separately
 * from `userProfile` (NOT a field on it). Encrypted value is preferred; falls
 * back to a plain string the same encrypted-first / plain-fallback way the rest
 * of the auth hydration reads stored values. Returns null when absent/blank.
 */
function resolveDomain(): string | null {
  const encrypted = secureGetItem<unknown>("domain");
  if (typeof encrypted === "string" && encrypted.trim()) {
    return encrypted.trim();
  }
  const plain = localStorage.getItem("domain");
  if (plain) {
    const trimmed = plain.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
      } catch {
        return trimmed;
      }
    }
  }
  return null;
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

export interface MyVesselAssignment {
  vesselId: string;
  vessel?: string;
  imoNumber?: string;
}

function normalizeMyVessels(
  profile: Record<string, any> | null | undefined,
): MyVesselAssignment[] {
  let raw = profile?.myVessels ?? profile?.my_vessels ?? [];

  // The external login can deliver the assigned mini-fleet in several shapes:
  // a JSON-encoded array string, a CSV/semicolon list, an array of bare vessel
  // id strings, or an array of assignment objects. Normalize every shape so a
  // populated profile never silently resolves to an empty fleet.
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        raw = trimmed.split(/[,;]/);
      }
    } else {
      raw = trimmed.split(/[,;]/);
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry: any) => {
      if (typeof entry === "string") {
        return {
          vesselId: entry.trim(),
          vessel: undefined,
          imoNumber: undefined,
        };
      }
      return {
        vesselId: String(
          entry?.vesselId ??
            entry?.vessel_id ??
            entry?.vuid ??
            entry?.vuuid ??
            entry?.id ??
            "",
        ).trim(),
        vessel: entry?.vessel ?? entry?.vesselName ?? entry?.name ?? undefined,
        imoNumber: entry?.imoNumber ?? entry?.imo_number ?? undefined,
      };
    })
    .filter((v: MyVesselAssignment) => !!v.vesselId);
}

interface AuthContextType {
  currentUser: PublicUser | null;
  myVessels: MyVesselAssignment[];
  /** Organization/tenant code from the standalone encrypted `domain`
   * localStorage key (NOT a field on userProfile). Null when absent. */
  domain: string | null;
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

/**
 * Audit Phase 0 — map the authenticated user to the audit-relevant identity that the fetch
 * interceptor forwards to PMS (x-user-* headers). Returns null when there is no user (logout).
 */
function toActiveIdentity(
  user: PublicUser | null | undefined,
): ActiveIdentity | null {
  if (!user) return null;
  return {
    userId: user.userUuid ?? null,
    name: user.fullName ?? user.username ?? null,
    email: user.email ?? null,
    userType: user.userType ?? null,
    role: user.role ?? null,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [myVessels, setMyVessels] = useState<MyVesselAssignment[]>([]);
  const [domain, setDomain] = useState<string | null>(null);
  const [userType, setUserType] = useState<UIRole | null>(null);

  useEffect(() => {
    let resolvedUser: PublicUser | null = null;
    let resolvedUserType: UIRole | null = null;
    let resolvedMyVessels: MyVesselAssignment[] = [];

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
      resolvedMyVessels = normalizeMyVessels(encryptedProfile);
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
        resolvedMyVessels = normalizeMyVessels(plainProfile);
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
    setMyVessels(resolvedMyVessels);
    setDomain(resolveDomain());
    setUserType(resolvedUserType);
    const hydratedRankChanged = setActiveRank(resolvedUser?.rank_name ?? null);
    // Audit Phase 0 — forward the authenticated identity to PMS on every API call.
    setActiveIdentity(toActiveIdentity(resolvedUser));
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

    // Keep assigned-fleet ("My Vessel") scope in sync with the freshly
    // logged-in account. The vessel assignments live on the stored
    // userProfile (encrypted preferred, plain fallback), so re-read it here
    // rather than relying solely on the initial mount hydration.
    let loginMyVessels: MyVesselAssignment[] = [];
    const encLoginProfile = secureGetItem<Record<string, any>>("userProfile");
    if (encLoginProfile) {
      loginMyVessels = normalizeMyVessels(encLoginProfile);
    } else {
      try {
        const raw = localStorage.getItem("userProfile");
        if (raw) loginMyVessels = normalizeMyVessels(JSON.parse(raw));
      } catch {
        loginMyVessels = [];
      }
    }
    setMyVessels(loginMyVessels);
    setDomain(resolveDomain());

    const rankChanged = setActiveRank(sanitizedUser.rank_name ?? null);
    // Audit Phase 0 — forward the authenticated identity to PMS on every API call.
    setActiveIdentity(toActiveIdentity(sanitizedUser));
    if (rankChanged) {
      invalidateRankScopedQueries();
    }
  };

  const logout = () => {
    // Capture the role before we clear local state below, so Shipskart evicts
    // the session for the SAME account Purchasing opened (backend maps role→account).
    const roleForLogout = currentUser?.role ?? "";
    // Best-effort Shipskart SSO logout (Purchasing module). Per the
    // integration guide we notify Shipskart BEFORE clearing the local
    // session, but it must NEVER block local logout — fire-and-forget,
    // errors are logged only. The backend endpoint is idempotent.
    void (async () => {
      try {
        await apiRequest("POST", "/technical/api/shipskart/sso/logout", {
          role: roleForLogout,
        });
      } catch (err) {
        console.error("[Shipskart] logout call failed (non-blocking):", err);
      }
    })();

    // TODO(server-auth): when this app's backend gains real session/token
    // auth (it currently runs mock auth), also call its server logout endpoint
    // here to invalidate the server session. Today logout is client-side only.

    // Wipe all auth-related localStorage so a reload cannot re-hydrate the
    // previous user (otherwise AuthContext's mount effect re-authenticates).
    secureClear();

    setCurrentUser(null);
    setUserType(null);
    setMyVessels([]);
    setDomain(null);
    const rankChanged = setActiveRank(null);
    // Audit Phase 0 — clear the forwarded identity on logout.
    setActiveIdentity(null);
    if (rankChanged) {
      invalidateRankScopedQueries();
    }
  };

  const value: AuthContextType = {
    currentUser,
    myVessels,
    domain,
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
