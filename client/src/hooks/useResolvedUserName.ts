import { useAuth } from "@/contexts/AuthContext";
import { secureGetItem } from "@/utils/secureStorage";

/**
 * Resolves the real logged-in user's display name for change-request
 * requester/reviewer fields, matching ChangeRequestFormExact's approach.
 *
 * A real SAILERP session requires BOTH an encrypted userType AND a role on
 * the profile — checking userProfile alone is not sufficient, because a
 * missing userType makes AuthContext fall back to DEFAULT_USER even when a
 * profile key is present.
 *
 * Auth hydrates asynchronously (currentUser starts as null), so callers that
 * capture the name at mount time should re-read once `currentUser` resolves.
 * For user-triggered submissions (the common case) auth is already hydrated.
 */
export function useResolvedUserName(): { resolvedUserName: string; hasRealSession: boolean } {
  const { currentUser } = useAuth();
  const encryptedProfile = secureGetItem<Record<string, any>>("userProfile");
  const encryptedUserType = secureGetItem<string>("userType");
  const hasRealSession = !!(encryptedProfile && encryptedUserType && encryptedProfile?.role);
  // Use the hydrated user's name even without a real encrypted session: in the
  // Replit dev workspace AuthContext falls back to a default dev user, and CRs
  // created there should show that name rather than 'Unknown'. In production a
  // missing session means signed out (token layer redirects to login anyway).
  const resolvedUserName = currentUser?.fullName || currentUser?.username || 'Unknown';
  return { resolvedUserName, hasRealSession };
}
