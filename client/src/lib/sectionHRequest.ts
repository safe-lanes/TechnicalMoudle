import type { PublicUser } from "@shared/schema";
import { isReplit } from "./env";
import { apiRequest } from "./queryClient";
import { hasLoggedOutMarker } from "@/utils/secureStorage";

/**
 * Only Section H endpoints use the approved default workspace actor. Production
 * continues through the existing encrypted credentials/profile request path.
 */
export async function sectionHRequest(
  user: PublicUser | null, method: string, url: string, data?: unknown,
): Promise<Response> {
  if (!user || hasLoggedOutMarker()) throw new Error("Please sign in to access Classification & Regulatory Data.");
  if (!isReplit()) return apiRequest(method, url, data);
  if (!/^\/technical\/api\/component-class-regulatory(?:\/[^?#]*)?(?:\?includeDeleted=true)?$/.test(url) &&
      !/^\/technical\/api\/fleet\/master-lists\?listType=(classificationSociety|surveyType)$/.test(url)) {
    throw new Error("Development Section H access cannot be used for this endpoint.");
  }
  // Explicit caller headers take precedence over the global identity interceptor.
  // These select a server-owned development actor; they are NOT authentication.
  const headers: Record<string, string> = {
    "x-section-h-development": "default-user",
    "x-user-id": encodeURIComponent(user.userUuid || ""),
    "x-user-role": encodeURIComponent(user.role),
    "x-user-type": user.userType || "",
  };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method, headers, credentials: "include",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text() || response.statusText}`);
  return response;
}
