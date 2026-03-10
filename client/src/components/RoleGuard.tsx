import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@shared/schema";

interface RoleGuardProps {
  children: ReactNode;
  roles?: UserRole | UserRole[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export function RoleGuard({ children, roles, requireAll = false, fallback = null }: RoleGuardProps) {
  const { hasRole, currentUser } = useAuth();

  if (!currentUser) {
    return <>{fallback}</>;
  }

  if (!roles) {
    return <>{children}</>;
  }

  let hasAccess: boolean;
  
  if (Array.isArray(roles)) {
    if (requireAll) {
      hasAccess = roles.every(role => hasRole(role));
    } else {
      hasAccess = roles.some(role => hasRole(role));
    }
  } else {
    hasAccess = hasRole(roles);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface AdminOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGuard roles={["PMS Admin", "Sail Admin"]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

interface OfficeOrAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function OfficeOrAdmin({ children, fallback = null }: OfficeOrAdminProps) {
  return (
    <RoleGuard roles={["Office", "PMS Admin", "Sail Admin"]} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

interface ShipOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ShipOnly({ children, fallback = null }: ShipOnlyProps) {
  return (
    <RoleGuard roles="Ship" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
