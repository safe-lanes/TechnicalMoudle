/**
 * ViewModeGate (Task #324) — fail-closed app gate on the server-resolved view mode.
 *
 * Renders children ONLY when resolution succeeded (or no user is present yet —
 * login screens must stay reachable). Sail Admin resolves via a local constant
 * bypass, so this gate can never lock out the fixer role.
 *
 *   loading → lightweight spinner (brief; resolve is one cached GET)
 *   error   → retry screen (server/network failure — never guess a mode)
 *   blocked → "role not mapped" screen (admin must map the role first)
 */
import { ReactNode } from "react";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

function GateScreen({
  icon,
  title,
  message,
  onRetry,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white border rounded-lg shadow-sm p-8 text-center space-y-4">
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-lg font-semibold text-gray-900" data-testid="text-gate-title">
          {title}
        </h1>
        <p className="text-sm text-gray-600" data-testid="text-gate-message">
          {message}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" data-testid="button-gate-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function ViewModeGate({ children }: { children: ReactNode }) {
  const { currentUser, uiRoleResolution } = useAuth();

  // No user yet (pre-hydration / logged out) — don't block the login surface.
  if (!currentUser) return <>{children}</>;

  switch (uiRoleResolution.status) {
    case "loading":
    case "idle":
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" data-testid="loader-view-mode" />
        </div>
      );
    case "error":
      return (
        <GateScreen
          icon={<ShieldAlert className="h-10 w-10 text-amber-500" />}
          title="Unable to verify your access"
          message="We couldn't determine your view mode because the server didn't respond. Please retry — access stays blocked until verification succeeds."
          onRetry={uiRoleResolution.retry}
        />
      );
    case "blocked":
      return (
        <GateScreen
          icon={<ShieldAlert className="h-10 w-10 text-red-500" />}
          title="Your role isn't mapped to a view mode"
          message={
            uiRoleResolution.reason === "ROLE_NOT_FOUND"
              ? "Your login role was not recognized by the system. Please contact your administrator."
              : "An administrator needs to assign a view mode to your role in Access Control before you can use the application."
          }
          onRetry={uiRoleResolution.retry}
        />
      );
    default:
      return <>{children}</>;
  }
}
