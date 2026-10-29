import type { PublicUser } from "./schema";

/**
 * Single definition for AuthContext's default workspace user and Section H's
 * server-owned development actor. This is public configuration, not a session.
 * Never use it to authenticate a production request.
 */
export function createDefaultDevelopmentUser(): PublicUser {
  return {
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
    isSync: null,
    createdByUuid: null,
    updatedByUuid: null,
    isDeleted: null,
    sortOrder: null,
  };
}

/** Pure, Section H-only selection; other modules keep their existing login flow. */
export function selectSectionHUser(
  appEnvironment: string | undefined,
  currentUser: PublicUser | null,
  defaultUser: PublicUser,
  loggedOut: boolean,
): PublicUser | null {
  if (loggedOut || !currentUser) return null;
  return appEnvironment === "replit" ? defaultUser : currentUser;
}
