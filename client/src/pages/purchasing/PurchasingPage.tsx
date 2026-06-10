import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Purchasing — embeds the Shipskart platform via ticket-based SSO.
 *
 * Flow: we ask our own backend (which holds the API key + HMAC secret) to
 * call Shipskart's /sso/initiate. The backend returns a fully-formed
 * iframeUrl (one-time code + partner already embedded). We drop that URL
 * straight into the iframe — we do NOT reconstruct it.
 *
 * The SSO code is single-use and expires in ~60s, so we fetch a fresh
 * iframeUrl every time this page mounts.
 */
export default function PurchasingPage() {
  const { currentUser } = useAuth();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleBlocked, setRoleBlocked] = useState(false);

  // The logged-in role (already decrypted by AuthContext) drives which Shipskart
  // account Purchasing opens. The backend has no real auth, so we pass it here —
  // the same pattern the alerts endpoint uses (?role=). Backend falls back to
  // req.user.role if this is absent.
  const userRole = currentUser?.role ?? "";

  const initiate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRoleBlocked(false);
    try {
      // Direct fetch (not apiRequest) so we can inspect the 403 ROLE_NOT_MAPPED
      // body and branch on it instead of treating it as a generic error.
      const res = await fetch("/technical/api/shipskart/sso/initiate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: userRole }),
      });
      const data = await res.json().catch(() => null);

      if (res.status === 403 && data?.errorCode === "ROLE_NOT_MAPPED") {
        setRoleBlocked(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Request failed (${res.status}).`);
      }
      if (!data?.iframeUrl) {
        throw new Error("No iframeUrl returned by the SSO service.");
      }
      setIframeUrl(data.iframeUrl);
    } catch (err: any) {
      console.error("[Purchasing] SSO initiate failed:", err);
      setError(err?.message || "Failed to load Purchasing.");
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  // Wait until auth has hydrated before calling SSO. currentUser is null on the
  // first render(s) (AuthContext loads/decrypts the profile asynchronously), so
  // firing immediately would POST initiate with role:"" → a spurious 403
  // ROLE_NOT_MAPPED. Once currentUser is present, userRole is the real role and
  // initiate (dep: userRole) runs with it. The loading spinner shows until then.
  useEffect(() => {
    if (!currentUser) return;
    initiate();
  }, [currentUser, initiate]);

  if (loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        data-testid="purchasing-loading"
      >
        <div className="flex flex-col items-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <span>Connecting to Purchasing…</span>
        </div>
      </div>
    );
  }

  if (roleBlocked) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        data-testid="purchasing-role-blocked"
      >
        <div className="text-center max-w-md">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Purchasing not available for your role
          </h2>
          <p className="text-gray-500">
            Purchasing is not available for your role. Please contact your
            administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  if (error || !iframeUrl) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        data-testid="purchasing-error"
      >
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Couldn’t open Purchasing
          </h2>
          <p className="text-gray-500 mb-4">
            {error || "The Purchasing session could not be started."}
          </p>
          <button
            onClick={initiate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            data-testid="purchasing-retry"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full" data-testid="purchasing-container">
      <iframe
        src={iframeUrl}
        title="Purchasing"
        className="w-full h-full border-0"
        // Attributes per SafeLane_SSO_INTEGRATION_GUIDE.pdf §7.1.
        // allow-same-origin is required for the embedded Flutter app's
        // localStorage-based session.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="clipboard-read; clipboard-write"
        width="100%"
        height="100%"
        data-testid="purchasing-iframe"
      />
    </div>
  );
}
