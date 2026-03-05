import type { UserRole } from "@shared/schema";
import { secureGetItem, secureSetItem } from "./secureStorage";

export interface ModulePermissions {
  read: boolean;
  write: boolean;
  approve: boolean;
  admin: boolean;
}

export interface RoleAccessData {
  roleId: string;
  roleName: string;
  modules: {
    pms: ModulePermissions;
    defects: ModulePermissions;
    spares: ModulePermissions;
    stores: ModulePermissions;
    reports: ModulePermissions;
    admin: ModulePermissions;
    certSurveys: ModulePermissions;
  };
  actions: {
    createWorkOrder: boolean;
    editWorkOrder: boolean;
    deleteWorkOrder: boolean;
    approveWorkOrder: boolean;
    createDefect: boolean;
    editDefect: boolean;
    closeDefect: boolean;
    approveDefect: boolean;
    manageFleet: boolean;
    manageUsers: boolean;
    bulkImport: boolean;
    exportData: boolean;
  };
  vesselAccess: "all" | "assigned";
}

const PMS_ADMIN_ACCESS: RoleAccessData = {
  roleId: "role-pms-admin",
  roleName: "PMS Admin",
  modules: {
    pms: { read: true, write: true, approve: true, admin: true },
    defects: { read: true, write: true, approve: true, admin: true },
    spares: { read: true, write: true, approve: true, admin: true },
    stores: { read: true, write: true, approve: true, admin: true },
    reports: { read: true, write: true, approve: true, admin: true },
    admin: { read: true, write: true, approve: true, admin: true },
    certSurveys: { read: true, write: true, approve: true, admin: true },
  },
  actions: {
    createWorkOrder: true,
    editWorkOrder: true,
    deleteWorkOrder: true,
    approveWorkOrder: true,
    createDefect: true,
    editDefect: true,
    closeDefect: true,
    approveDefect: true,
    manageFleet: true,
    manageUsers: true,
    bulkImport: true,
    exportData: true,
  },
  vesselAccess: "all",
};

const OFFICE_ACCESS: RoleAccessData = {
  roleId: "role-office",
  roleName: "Office",
  modules: {
    pms: { read: true, write: true, approve: false, admin: false },
    defects: { read: true, write: true, approve: true, admin: false },
    spares: { read: true, write: true, approve: false, admin: false },
    stores: { read: true, write: true, approve: false, admin: false },
    reports: { read: true, write: false, approve: false, admin: false },
    admin: { read: true, write: false, approve: false, admin: false },
    certSurveys: { read: true, write: true, approve: false, admin: false },
  },
  actions: {
    createWorkOrder: true,
    editWorkOrder: true,
    deleteWorkOrder: false,
    approveWorkOrder: true,
    createDefect: true,
    editDefect: true,
    closeDefect: true,
    approveDefect: false,
    manageFleet: false,
    manageUsers: false,
    bulkImport: true,
    exportData: true,
  },
  vesselAccess: "all",
};

const SHIP_ACCESS: RoleAccessData = {
  roleId: "role-ship",
  roleName: "Ship",
  modules: {
    pms: { read: true, write: true, approve: false, admin: false },
    defects: { read: true, write: true, approve: false, admin: false },
    spares: { read: true, write: false, approve: false, admin: false },
    stores: { read: true, write: false, approve: false, admin: false },
    reports: { read: true, write: false, approve: false, admin: false },
    admin: { read: false, write: false, approve: false, admin: false },
    certSurveys: { read: true, write: false, approve: false, admin: false },
  },
  actions: {
    createWorkOrder: true,
    editWorkOrder: true,
    deleteWorkOrder: false,
    approveWorkOrder: false,
    createDefect: true,
    editDefect: true,
    closeDefect: false,
    approveDefect: false,
    manageFleet: false,
    manageUsers: false,
    bulkImport: false,
    exportData: true,
  },
  vesselAccess: "assigned",
};

const ROLE_ACCESS_MAP: Record<UserRole, RoleAccessData> = {
  "PMS Admin": PMS_ADMIN_ACCESS,
  Office: OFFICE_ACCESS,
  Ship: SHIP_ACCESS,
};

export function generateRoleAccessData(role: UserRole): RoleAccessData {
  const access = ROLE_ACCESS_MAP[role];
  if (!access) {
    return SHIP_ACCESS;
  }
  return { ...access };
}

export function getRoleAccessData(): RoleAccessData | null {
  return secureGetItem<RoleAccessData>("Role_Access_Data");
}

export function setRoleAccessData(data: RoleAccessData): void {
  secureSetItem("Role_Access_Data", data);
}

export function canAccessModule(
  moduleName: keyof RoleAccessData["modules"],
  permission: keyof ModulePermissions,
  data?: RoleAccessData | null,
): boolean {
  const accessData = data ?? getRoleAccessData();
  if (!accessData) return false;
  const mod = accessData.modules[moduleName];
  if (!mod) return false;
  return mod[permission] === true;
}

export function canPerformAction(
  actionName: keyof RoleAccessData["actions"],
  data?: RoleAccessData | null,
): boolean {
  const accessData = data ?? getRoleAccessData();
  if (!accessData) return false;
  return accessData.actions[actionName] === true;
}
