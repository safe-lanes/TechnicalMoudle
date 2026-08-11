import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { PublicUser, UserRole } from "@shared/schema";
import type { UIRole } from "@shared/uiRoles";
import {
  useViewModeResolution,
  type ViewModeResolution,
} from "@/hooks/useViewModeResolution";
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
  username: "Jeevan Admin",
  fullName: "Jeevan SuperAdmin",
  email: "jeevan.naik@safe-lanes.com",
  role: "Sail Admin",
  userType: "Office",
  vesselId: null,
  department: null,
  isActive: true,
  crewDesignation: "Marine Manager",
  rank_name: "Master",
  userUuid: "b808b560-26c4-4c4b-8c0f-8c785e49770c",
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
  /** Full fail-closed resolution state (Task #324) — loading/error/blocked drives the app gate. */
  uiRoleResolution: ViewModeResolution;
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

/**
 * CAPTURE-AT-LOGIN — hand the decrypted SAILERP `myVessels` set to the server ONCE per
 * page load. The server can never read the encrypted userProfile itself, so this is the
 * only way user↔vessel assignments reach `master_user_vessels`, which is what the
 * Shipskart reconciler uses to map users to vessels for Purchasing.
 *
 * Fire-and-forget by design: it must NEVER block login or surface an error to the user.
 * The sessionStorage guard keeps it to one call per load (both the mount-hydration and
 * the explicit login path call it). The user uuid is taken server-side from the
 * x-user-id header — deliberately not sent in the body.
 *
 * ⚠️ THE GUARD MUST BE CLEARED ON LOGOUT — see clearVesselCaptureGuard below.
 */
const VESSEL_CAPTURE_GUARD = "pms.vesselAssignmentsPosted";

/**
 * Drop the once-per-session capture guard so the NEXT login re-posts the vessel list.
 *
 * WHY (bug found 2026-08-10): the guard lives in sessionStorage, which is scoped to the
 * browser TAB and survives BOTH a logout and a hard refresh — only closing the tab ends
 * it. `logout()` calls secureClear(), which touches localStorage only, and nothing else
 * in the client cleared sessionStorage. So a same-tab logout→login skipped the POST
 * entirely: a vessel reassignment made between the two logins never reached
 * `master_user_vessels`, and therefore never reached Shipskart. The only cure was to
 * close the browser, which no operator would ever guess.
 *
 * Clears EVERY user's guard, not just the current one: at logout the uuid may already be
 * gone, and a shared machine can carry stale keys for whoever used the tab before.
 */
function clearVesselCaptureGuard(): void {
  try {
    // Object.keys returns a snapshot, so removing while iterating is safe.
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(`${VESSEL_CAPTURE_GUARD}:`)) sessionStorage.removeItem(key);
    }
  } catch {
    // private-mode / storage-disabled: there was no guard to clear either.
  }
}

function captureVesselAssignments(assignments: MyVesselAssignment[], userUuid: string | null | undefined): void {
  if (!userUuid) return; // no forwarded identity → the server would reject it anyway
  // NEVER post an empty set: an absent/unreadable encrypted userProfile normalises to []
  // and must not be mistaken for "this user has no vessels". The server no-ops on empty
  // too (belt and braces); a real full revoke is an explicit admin action.
  if (assignments.length === 0) return;
  const guardKey = `${VESSEL_CAPTURE_GUARD}:${userUuid}`;
  try {
    if (sessionStorage.getItem(guardKey)) return;
    sessionStorage.setItem(guardKey, String(assignments.length));
  } catch {
    // private-mode / storage-disabled: fall through and just post once per call site
  }
  void (async () => {
    try {
      await apiRequest("POST", "/technical/api/shipskart/vessel-assignments", {
        myVessels: assignments,
      });
    } catch (err) {
      // Never block the user — a failed capture just means the reconciler has no
      // assignments for them yet; the next login retries.
      console.error("[VesselAssignments] capture failed (non-blocking):", err);
    }
  })();
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [myVessels, setMyVessels] = useState<MyVesselAssignment[]>([]);
  const [domain, setDomain] = useState<string | null>(null);

  // Task #324 — view mode is resolved SERVER-SIDE (DB mapping, fail-closed with
  // the Office/'Sail Admin' bypass), replacing the old synchronous
  // mapLoggedRoleToUIRole call. Shared TanStack key with UIRoleContext.
  const uiRoleResolution = useViewModeResolution(
    currentUser?.userType ?? null,
    currentUser?.role ?? null,
  );
  const userType = uiRoleResolution.uiRole;

  useEffect(() => {
    let resolvedUser: PublicUser | null = null;
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
    }
    // SECURITY: no plain-text localStorage fallback. Plain `userProfile`/
    // `userType` values are attacker-editable and must never be trusted as
    // identity inputs — only the encrypted keys written by the real login
    // flow count. Absent/undecryptable keys fall through to DEFAULT_USER.

    if (!resolvedUser) {
      resolvedUser = DEFAULT_USER;
    }

    setCurrentUser(resolvedUser);
    setMyVessels(resolvedMyVessels);
    setDomain(resolveDomain());
    const hydratedRankChanged = setActiveRank(resolvedUser?.rank_name ?? null);
    // Audit Phase 0 — forward the authenticated identity to PMS on every API call.
    setActiveIdentity(toActiveIdentity(resolvedUser));
    // Capture-at-login (hydration path: an already-logged-in session reloading the app).
    // AFTER setActiveIdentity so the x-user-id header is on the request.
    captureVesselAssignments(resolvedMyVessels, resolvedUser?.userUuid);
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
    // View mode resolves reactively from the server via useViewModeResolution
    // once currentUser updates (Task #324) — no synchronous mapping here.
    setCurrentUser(sanitizedUser);

    // Keep assigned-fleet ("My Vessel") scope in sync with the freshly
    // logged-in account. The vessel assignments live on the stored
    // userProfile (ENCRYPTED ONLY — plain-text storage is untrusted), so
    // re-read it here rather than relying solely on the initial mount hydration.
    let loginMyVessels: MyVesselAssignment[] = [];
    const encLoginProfile = secureGetItem<Record<string, any>>("userProfile");
    if (encLoginProfile) {
      loginMyVessels = normalizeMyVessels(encLoginProfile);
    }
    setMyVessels(loginMyVessels);
    setDomain(resolveDomain());

    const rankChanged = setActiveRank(sanitizedUser.rank_name ?? null);
    // Audit Phase 0 — forward the authenticated identity to PMS on every API call.
    setActiveIdentity(toActiveIdentity(sanitizedUser));
    // Capture-at-login (fresh login path). AFTER setActiveIdentity so x-user-id is sent.
    captureVesselAssignments(loginMyVessels, sanitizedUser.userUuid);
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
    // secureClear() is localStorage-only, and the capture guard lives in sessionStorage —
    // which survives logout. Without this the next login in the SAME TAB skips the vessel
    // capture, so an assignment changed between the two logins never reaches the server.
    clearVesselCaptureGuard();

    setCurrentUser(null);
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
    uiRoleResolution,
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
