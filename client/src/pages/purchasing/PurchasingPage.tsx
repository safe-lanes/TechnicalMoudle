import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, Lock, Clock } from "lucide-react";
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
  // WHY A USER IS BLOCKED, IN FULL (2026-08-10). Both refusals used to render one flat
  // sentence — "not available yet, contact your administrator" — which told the person
  // nothing and told support even less: a missing email and an unmapped role looked
  // identical, and the only way to tell them apart was to open the database. The server now
  // returns a plain-English explanation, what happens next, and a support reference; this
  // screen renders all of it. Every field is optional so an older server still renders.
  const [block, setBlock] = useState<{
    kind: "role" | "account";
    title?: string;
    detail?: string;
    whatHappensNext?: string;
    retry?: "click" | "sync" | "support";
    reasonCode?: string;
    reason?: string;
    userRole?: string | null;
    userUuid?: string | null;
    occurredAt?: string;
    message?: string;
  } | null>(null);

  // The logged-in role (already decrypted by AuthContext) drives which Shipskart
  // account Purchasing opens. The backend has no real auth, so we pass it here —
  // the same pattern the alerts endpoint uses (?role=). Backend falls back to
  // req.user.role if this is absent.
  const userRole = currentUser?.role ?? "";

  const initiate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBlock(null);
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
        setBlock({ kind: "role", ...(data ?? {}) });
        return;
      }
      // 409 USER_NOT_PROVISIONED — the user's own Shipskart account could not be created
      // or resolved. Deliberately blocked (no shared-account fallback); the backend has
      // already logged the reason and recorded it for the reconciler to retry.
      if (res.status === 409 && data?.errorCode === "USER_NOT_PROVISIONED") {
        setBlock({ kind: "account", ...(data ?? {}) });
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

  if (block) {
    const isRole = block.kind === "role";
    return (
      <div
        className="flex h-full w-full items-start justify-center overflow-auto py-10 px-4"
        data-testid={isRole ? "purchasing-role-blocked" : "purchasing-not-provisioned"}
      >
        <div className="w-full max-w-xl">
          <div className="flex flex-col items-center text-center mb-6">
            {isRole ? (
              <Lock className="h-12 w-12 text-gray-400 mb-4" />
            ) : (
              <Clock className="h-12 w-12 text-amber-500 mb-4" />
            )}
            <h2 className="text-xl font-semibold text-gray-800 mb-2" data-testid="purchasing-block-title">
              {block.title ?? (isRole ? "Purchasing not available for your role" : "Purchasing is not available yet")}
            </h2>
            <p className="text-gray-600 leading-relaxed" data-testid="purchasing-block-detail">
              {block.detail ?? block.message ?? "Your Purchasing account is still being set up."}
            </p>
          </div>

          {block.whatHappensNext && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-1">What happens next</p>
              <p className="text-sm text-blue-900/90 leading-relaxed" data-testid="purchasing-block-next">
                {block.whatHappensNext}
              </p>
            </div>
          )}

          {/* Support reference — everything a support engineer needs, without them asking
              the user to describe the screen. Collapsed so it never shouts at the client. */}
          {(block.reasonCode || block.reason) && (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6 text-left">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                Information for support
              </summary>
              <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
                {block.reasonCode && (
                  <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Reference</dt>
                    <dd className="font-mono" data-testid="purchasing-block-code">{block.reasonCode}</dd></div>
                )}
                {block.reason && (
                  <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Detail</dt>
                    <dd className="font-mono break-all">{block.reason}</dd></div>
                )}
                {block.userRole && (
                  <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Role</dt>
                    <dd>{block.userRole}</dd></div>
                )}
                {block.userUuid && (
                  <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">User ID</dt>
                    <dd className="font-mono break-all">{block.userUuid}</dd></div>
                )}
                {block.occurredAt && (
                  <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">Time</dt>
                    <dd>{new Date(block.occurredAt).toLocaleString()}</dd></div>
                )}
              </dl>
            </details>
          )}

          <div className="flex flex-col items-center gap-3">
            {block.retry !== "support" && (
              <button
                onClick={initiate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                data-testid="purchasing-not-provisioned-retry"
              >
                Try again
              </button>
            )}
            <p className="text-sm text-gray-500 text-center">
              If this continues, please contact support and quote the reference above.
            </p>
          </div>
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
