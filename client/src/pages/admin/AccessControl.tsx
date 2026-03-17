import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Save, ChevronRight, ChevronDown, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Role {
  id: number;
  ruid: string;
  assignedRole: string;
  roletype: string;
  isActive: boolean;
  sortOrder: number | null;
}

interface MenuItem {
  id: number;
  muid: string;
  name: string;
  displayName: string;
  route: string | null;
  parentMenu: string | null;
  isActive: boolean;
  sortOrder: number | null;
}

interface Permission {
  menuMuid: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export default function AccessControl() {
  const [selectedRoleRuid, setSelectedRoleRuid] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['/technical/api/admin/roles'],
  });

  const menuItemsQuery = useQuery<MenuItem[]>({
    queryKey: ['/technical/api/admin/menu-items'],
  });

  const permissionsQuery = useQuery<any[]>({
    queryKey: ['/technical/api/admin/access-control', selectedRoleRuid],
    queryFn: async () => {
      const res = await fetch(`/technical/api/admin/access-control/${selectedRoleRuid}`);
      if (!res.ok) throw new Error('Failed to fetch permissions');
      return res.json();
    },
    enabled: !!selectedRoleRuid,
  });

  const menuTree = useMemo(() => {
    if (!menuItemsQuery.data) return [];
    const items = menuItemsQuery.data.filter((i) => i.name !== "admin-access-control");
    const parents = items.filter((i) => !i.parentMenu).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return parents.map((parent) => ({
      ...parent,
      children: items
        .filter((i) => i.parentMenu === parent.muid)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }));
  }, [menuItemsQuery.data]);

  const loadPermissions = useCallback(
    (roleRuid: string) => {
      setSelectedRoleRuid(roleRuid);
      setIsDirty(false);
    },
    []
  );

  const prevPermissionsData = useMemo(() => {
    if (!permissionsQuery.data || !selectedRoleRuid) return null;
    const map: Record<string, Permission> = {};
    for (const p of permissionsQuery.data) {
      map[p.menuMuid] = {
        menuMuid: p.menuMuid,
        canView: p.canView ?? false,
        canCreate: p.canCreate ?? false,
        canEdit: p.canEdit ?? false,
        canDelete: p.canDelete ?? false,
      };
    }
    return map;
  }, [permissionsQuery.data, selectedRoleRuid]);

  const effectivePermissions = useMemo(() => {
    if (isDirty) return permissions;
    return prevPermissionsData ?? {};
  }, [isDirty, permissions, prevPermissionsData]);

  const getPermission = (muid: string): Permission => {
    return effectivePermissions[muid] ?? {
      menuMuid: muid,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    };
  };

  const updatePermission = (muid: string, field: keyof Permission, value: boolean) => {
    const current = getPermission(muid);
    const updated = { ...current, menuMuid: muid, [field]: value };
    const newPerms = { ...effectivePermissions, [muid]: updated };
    setPermissions(newPerms);
    setIsDirty(true);
  };

  const toggleSelectAll = (muid: string, checked: boolean) => {
    const current = getPermission(muid);
    const updated = {
      ...current,
      menuMuid: muid,
      canView: checked,
      canCreate: checked,
      canEdit: checked,
      canDelete: checked,
    };
    const newPerms = { ...effectivePermissions, [muid]: updated };
    setPermissions(newPerms);
    setIsDirty(true);
  };

  const isAllChecked = (muid: string): boolean => {
    const p = getPermission(muid);
    return p.canView && p.canCreate && p.canEdit && p.canDelete;
  };

  const isSomeChecked = (muid: string): boolean => {
    const p = getPermission(muid);
    return (p.canView || p.canCreate || p.canEdit || p.canDelete) && !isAllChecked(muid);
  };

  const toggleExpand = (muid: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(muid)) next.delete(muid);
      else next.add(muid);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoleRuid) throw new Error("No role selected");
      const permsArray = Object.values(effectivePermissions).filter(
        (p) => p.canView || p.canCreate || p.canEdit || p.canDelete
      );
      const res = await apiRequest("PUT", `/technical/api/admin/access-control/${selectedRoleRuid}`, {
        permissions: permsArray,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/admin/access-control', selectedRoleRuid] });
      setIsDirty(false);
      toast({ title: "Permissions saved successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Failed to save permissions", description: error.message });
    },
  });

  const selectedRole = rolesQuery.data?.find((r) => r.ruid === selectedRoleRuid);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }} data-testid="access-control-page">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Access Control</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage role-based menu permissions</p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-64 flex-shrink-0 bg-white rounded-lg border border-gray-200 flex flex-col" data-testid="roles-panel">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Roles</h2>
          </div>
          <ScrollArea className="flex-1">
            {rolesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="p-2">
                {rolesQuery.data?.map((role) => (
                  <button
                    key={role.ruid}
                    onClick={() => loadPermissions(role.ruid)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      selectedRoleRuid === role.ruid
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                    data-testid={`role-item-${role.ruid}`}
                  >
                    {role.assignedRole}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-w-0" data-testid="permissions-panel">
          {!selectedRoleRuid ? (
            <div className="flex-1 flex items-center justify-center text-gray-400" data-testid="no-role-selected">
              <p>Select a role to manage permissions</p>
            </div>
          ) : permissionsQuery.isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Permissions for: <span className="text-blue-600">{selectedRole?.assignedRole}</span>
                </h2>
              </div>

              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-1 text-xs font-medium text-gray-500 uppercase">
                  <div>Menu Item</div>
                  <div className="text-center">Select All</div>
                  <div className="text-center">View</div>
                  <div className="text-center">Create</div>
                  <div className="text-center">Edit</div>
                  <div className="text-center">Delete</div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="divide-y divide-gray-100">
                  {menuTree.map((parent) => {
                    const isExpanded = expandedParents.has(parent.muid);
                    return (
                      <div key={parent.muid} data-testid={`menu-group-${parent.name}`}>
                        <div
                          className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-1 items-center px-4 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                          onClick={() => toggleExpand(parent.muid)}
                          data-testid={`menu-parent-${parent.name}`}
                        >
                          <div className="flex items-center gap-2 font-medium text-sm text-gray-800">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            {parent.displayName}
                          </div>
                          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isAllChecked(parent.muid) ? true : isSomeChecked(parent.muid) ? "indeterminate" : false}
                              onCheckedChange={(checked) => toggleSelectAll(parent.muid, !!checked)}
                              data-testid={`checkbox-selectall-${parent.name}`}
                            />
                          </div>
                          {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                            <div key={field} className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={getPermission(parent.muid)[field]}
                                onCheckedChange={(checked) => updatePermission(parent.muid, field, !!checked)}
                                data-testid={`checkbox-${field}-${parent.name}`}
                              />
                            </div>
                          ))}
                        </div>

                        {isExpanded &&
                          parent.children.map((child) => (
                            <div
                              key={child.muid}
                              className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-1 items-center px-4 py-2 pl-10 hover:bg-blue-50/30"
                              data-testid={`menu-child-${child.name}`}
                            >
                              <div className="text-sm text-gray-600">{child.displayName}</div>
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={isAllChecked(child.muid) ? true : isSomeChecked(child.muid) ? "indeterminate" : false}
                                  onCheckedChange={(checked) => toggleSelectAll(child.muid, !!checked)}
                                  data-testid={`checkbox-selectall-${child.name}`}
                                />
                              </div>
                              {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                                <div key={field} className="flex justify-center">
                                  <Checkbox
                                    checked={getPermission(child.muid)[field]}
                                    onCheckedChange={(checked) => updatePermission(child.muid, field, !!checked)}
                                    data-testid={`checkbox-${field}-${child.name}`}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !isDirty}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="btn-save-permissions"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
