import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface MenuPermission {
  menuMuid: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface MenuItem {
  muid: string;
  name: string;
  displayName: string;
  route: string | null;
  parentMenu: string | null;
  isActive: boolean;
  sortOrder: number | null;
}

type PermissionStatus = "loading" | "unconfigured" | "configured" | "error";

interface PermissionsContextType {
  isLoading: boolean;
  isConfigured: boolean;
  status: PermissionStatus;
  canViewRoute: (route: string) => boolean;
  canViewMenu: (menuName: string) => boolean;
  hasAnyChildAccess: (parentModule: string) => boolean;
  getPermission: (menuName: string) => MenuPermission | null;
  canViewSidebarItem: (subModule: string, itemId: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const MENU_NAME_MAP: Record<string, Record<string, string>> = {
  pms: {
    "dashboard": "pms-dashboard",
    "components": "pms-components",
    "work-orders": "pms-work-orders",
    "running-hrs": "pms-running-hrs",
    "spares": "pms-spares",
    "stores": "pms-stores",
    "reports": "pms-reports",
    "modify-pms": "pms-modify-pms",
    "admin": "pms-admin",
  },
  defects: {
    "dashboard": "defects-dashboard",
    "defect-log": "defects-active",
    "coc": "defects-coc",
    "recurring": "defects-recurring",
    "resolved": "defects-resolved",
    "reports": "defects-reports",
  },
  "cert-surveys": {
    "certificates": "cert-certificates",
    "surveys": "cert-surveys-page",
  },
  admin: {
    "masters": "admin-masters",
    "ships-certificates": "admin-ships-certificates",
    "ships-surveys": "admin-ships-surveys",
    "access-control": "admin-access-control",
  },
};

const PARENT_MODULE_MAP: Record<string, string> = {
  "pms": "pms",
  "defects": "defects",
  "cert-surveys": "cert-surveys",
  "admin": "admin",
};

const ROUTE_TO_MENU_NAME: Record<string, string> = {
  "/pms/dashboard": "pms-dashboard",
  "/pms/components": "pms-components",
  "/pms/work-orders": "pms-work-orders",
  "/pms/running-hrs": "pms-running-hrs",
  "/spares": "pms-spares",
  "/stores": "pms-stores",
  "/pms/reports": "pms-reports",
  "/pms/modify-pms": "pms-modify-pms",
  "/pms/admin": "pms-admin",
  "/defects": "defects-dashboard",
  "/defects/active": "defects-active",
  "/defects/coc": "defects-coc",
  "/defects/recurring": "defects-recurring",
  "/defects/resolved": "defects-resolved",
  "/defects/reports": "defects-reports",
  "/cert-surveys/certificates": "cert-certificates",
  "/cert-surveys/surveys": "cert-surveys-page",
  "/admin/masters": "admin-masters",
  "/admin/ships-certificates": "admin-ships-certificates",
  "/admin/ships-surveys": "admin-ships-surveys",
  "/admin/access-control": "admin-access-control",
};

const CHILD_ROUTE_PATTERNS: Array<{ pattern: RegExp; parentMenuName: string }> = [
  { pattern: /^\/pms\/modify-pms\//, parentMenuName: "pms-modify-pms" },
  { pattern: /^\/pms\/work-orders\//, parentMenuName: "pms-work-orders" },
  { pattern: /^\/pms\/components\//, parentMenuName: "pms-components" },
  { pattern: /^\/pms\/maintenance-records/, parentMenuName: "pms-components" },
  { pattern: /^\/pms\/superintendent/, parentMenuName: "pms-work-orders" },
  { pattern: /^\/defects\/new$/, parentMenuName: "defects-active" },
  { pattern: /^\/defects\/edit\//, parentMenuName: "defects-active" },
  { pattern: /^\/admin\/masters\//, parentMenuName: "admin-masters" },
  { pattern: /^\/admin\/ships-certificates\//, parentMenuName: "admin-ships-certificates" },
  { pattern: /^\/admin\/ships-surveys\//, parentMenuName: "admin-ships-surveys" },
];

const MODULE_ENTRY_ROUTES: Record<string, string> = {
  "/": "pms",
  "/pms": "pms",
  "/admin": "admin",
  "/defects": "defects",
  "/cert-surveys": "cert-surveys",
  "/reports": "pms",
};

function resolveRouteToMenuName(route: string): string | null {
  const exact = ROUTE_TO_MENU_NAME[route];
  if (exact) return exact;

  for (const { pattern, parentMenuName } of CHILD_ROUTE_PATTERNS) {
    if (pattern.test(route)) return parentMenuName;
  }

  return null;
}

const SIDEBAR_ITEM_PARENT_MAP: Record<string, Record<string, string>> = {
  pms: {
    "modify-pms/jobs": "modify-pms",
    "superintendent": "work-orders",
  },
  defects: {
    "new": "defect-log",
    "edit": "defect-log",
  },
};

function resolveSidebarItemId(subModule: string, itemId: string): string {
  if (subModule === "pms" && itemId.startsWith("maintenance-records")) {
    return "components";
  }
  const parentMap = SIDEBAR_ITEM_PARENT_MAP[subModule];
  if (parentMap && parentMap[itemId]) return parentMap[itemId];
  return itemId;
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [permissions, setPermissions] = useState<Map<string, MenuPermission>>(new Map());
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [status, setStatus] = useState<PermissionStatus>("loading");

  useEffect(() => {
    if (!currentUser?.role) {
      setPermissions(new Map());
      setMenuItems([]);
      setStatus("unconfigured");
      return;
    }

    setStatus("loading");
    setPermissions(new Map());
    setMenuItems([]);

    const fetchPermissions = async () => {
      try {
        const [menuRes, roleRes] = await Promise.all([
          fetch("/technical/api/admin/menu-items"),
          fetch(`/technical/api/admin/role-by-name/${encodeURIComponent(currentUser.role)}`),
        ]);

        if (!menuRes.ok) {
          console.error("Failed to fetch menu items:", menuRes.status);
          setStatus("error");
          return;
        }

        const menuData: MenuItem[] = await menuRes.json();
        setMenuItems(menuData);

        if (!roleRes.ok) {
          if (roleRes.status === 404) {
            setStatus("unconfigured");
          } else {
            console.error("Failed to fetch role:", roleRes.status);
            setStatus("error");
          }
          return;
        }

        const roleData = await roleRes.json();
        const ruid = roleData.ruid;

        const permsRes = await fetch(`/technical/api/admin/access-control/${ruid}`);
        if (!permsRes.ok) {
          console.error("Failed to fetch permissions:", permsRes.status);
          setStatus("error");
          return;
        }

        const permsData = await permsRes.json();

        if (!permsData || permsData.length === 0) {
          setStatus("unconfigured");
          return;
        }

        const permsMap = new Map<string, MenuPermission>();
        for (const p of permsData) {
          permsMap.set(p.menuMuid, {
            menuMuid: p.menuMuid,
            canView: p.canView ?? false,
            canCreate: p.canCreate ?? false,
            canEdit: p.canEdit ?? false,
            canDelete: p.canDelete ?? false,
          });
        }
        setPermissions(permsMap);
        setStatus("configured");
      } catch (error) {
        console.error("Failed to fetch permissions:", error);
        setStatus("error");
      }
    };

    fetchPermissions();
  }, [currentUser?.role]);

  const isLoading = status === "loading";
  const isConfigured = status === "configured";
  const shouldDeny = status === "configured" || status === "error";

  const getMenuMuidByName = useCallback(
    (menuName: string): string | null => {
      const item = menuItems.find((m) => m.name === menuName);
      return item?.muid ?? null;
    },
    [menuItems]
  );

  const canViewMenu = useCallback(
    (menuName: string): boolean => {
      if (!shouldDeny) return true;
      if (status === "error") return false;
      const muid = getMenuMuidByName(menuName);
      if (!muid) return false;
      const perm = permissions.get(muid);
      return perm?.canView ?? false;
    },
    [shouldDeny, status, permissions, getMenuMuidByName]
  );

  const hasAnyChildAccess = useCallback(
    (parentModule: string): boolean => {
      if (!shouldDeny) return true;
      if (status === "error") return false;
      const parentMuid = getMenuMuidByName(parentModule);
      if (!parentMuid) return false;

      const children = menuItems.filter((m) => m.parentMenu === parentMuid);
      if (children.length === 0) return false;

      return children.some((child) => {
        const perm = permissions.get(child.muid);
        return perm?.canView ?? false;
      });
    },
    [shouldDeny, status, permissions, menuItems, getMenuMuidByName]
  );

  const canViewRoute = useCallback(
    (route: string): boolean => {
      if (!shouldDeny) return true;
      if (status === "error") return false;

      const moduleParent = MODULE_ENTRY_ROUTES[route];
      if (moduleParent) return hasAnyChildAccess(moduleParent);

      const menuName = resolveRouteToMenuName(route);
      if (!menuName) return false;
      return canViewMenu(menuName);
    },
    [shouldDeny, status, canViewMenu, hasAnyChildAccess]
  );

  const getPermission = useCallback(
    (menuName: string): MenuPermission | null => {
      if (!isConfigured) return null;
      const muid = getMenuMuidByName(menuName);
      if (!muid) return null;
      return permissions.get(muid) ?? null;
    },
    [isConfigured, permissions, getMenuMuidByName]
  );

  const canViewSidebarItem = useCallback(
    (subModule: string, itemId: string): boolean => {
      if (!shouldDeny) return true;
      if (status === "error") return false;
      const resolvedId = resolveSidebarItemId(subModule, itemId);
      const moduleMap = MENU_NAME_MAP[subModule];
      if (!moduleMap) return false;
      const menuName = moduleMap[resolvedId];
      if (!menuName) return false;
      return canViewMenu(menuName);
    },
    [shouldDeny, status, canViewMenu]
  );

  const value: PermissionsContextType = {
    isLoading,
    isConfigured,
    status,
    canViewRoute,
    canViewMenu,
    hasAnyChildAccess,
    getPermission,
    canViewSidebarItem,
  };

  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
