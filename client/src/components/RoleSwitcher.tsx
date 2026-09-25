import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { isReplit } from "@/lib/env";
import { VISIBLE_UI_ROLES, UI_ROLE_LABELS } from "@shared/uiRoles";
import { User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  compareExactRoleStrings,
  exactUserRole,
  userMatchesResolverRole,
} from "./testIdentityRoleSemantics";

const TEST_USERS_URL = "/technical/api/dev/test-users";

interface TestUserRecord extends Partial<import("@shared/schema").PublicUser> {
  [key: string]: any;
  userUuid?: string;
  uuid?: string;
  name?: string;
  rank?: string;
  rankName?: string;
  resolver?: unknown;
  resolverResult?: unknown;
  resolverResults?: unknown;
  assignments?: unknown[];
  assignedVessels?: unknown[];
  vessels?: unknown[];
}

interface VesselRecord {
  vuuid: string;
  name: string;
}

interface DefectsRoleUsage {
  roleId: string;
  roleLabel: string;
  assignedRole: string | null;
  roleStringsMatch: boolean;
  matchingActiveUsers: number;
  scopeScreenId: string;
  scopeLabel: string;
  classification: string;
  stepNumber: number;
  stepLabel: string;
  slotNumber: number;
}

interface DefectsWorkflowStatus {
  scopeScreenId: string;
  scopeLabel: string;
  classification: string;
  status: "active" | "no-active-workflow" | "engine-unavailable";
  usages: DefectsRoleUsage[];
}

function listFromPayload(payload: any): TestUserRecord[] {
  const users = Array.isArray(payload)
    ? payload
    : payload?.users ?? payload?.testUsers ?? payload?.data?.users ?? [];
  return Array.isArray(users) ? users : [];
}

function userUuid(user: TestUserRecord): string {
  return String(user.userUuid ?? user.uuid ?? user.id ?? "");
}

function userName(user: TestUserRecord): string {
  return String(user.fullName ?? user.full_name ?? user.name ?? user.username ?? userUuid(user));
}

function normalizedUserType(user: TestUserRecord): "Office" | "Ship" {
  const raw = String(user.userType ?? user.user_type ?? "").trim().toLowerCase();
  return raw === "ship" ? "Ship" : "Office";
}

function userDisambiguator(user: TestUserRecord, duplicate = false): string {
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const uuidSuffix = userUuid(user).slice(-6);
  if (email) return duplicate ? `${email} / ${uuidSuffix}` : email;
  return uuidSuffix;
}

function normalizedDuplicateKey(user: TestUserRecord): string {
  return `${userName(user).trim().toLocaleLowerCase()}\u0000${exactUserRole(user)}`;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function workflowStatusesFromPayload(payload: any): DefectsWorkflowStatus[] {
  const raw =
    payload?.defectsWorkflowRoles ??
    payload?.data?.defectsWorkflowRoles ??
    [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: any) => ({
    scopeScreenId: String(entry?.scopeScreenId ?? ""),
    scopeLabel: String(entry?.scopeLabel ?? entry?.scopeScreenId ?? ""),
    classification: String(entry?.classification ?? ""),
    status: entry?.status,
    usages: Array.isArray(entry?.usages) ? entry.usages : [],
  })).filter((entry) => entry.scopeScreenId && entry.classification);
}

function toPublicUser(raw: TestUserRecord): import("@shared/schema").PublicUser {
  const uuid = userUuid(raw);
  return {
    id: Number(raw.id) || 0,
    username: String(raw.username ?? raw.userName ?? raw.email ?? raw.name ?? uuid),
    fullName: String(raw.fullName ?? raw.full_name ?? raw.name ?? raw.username ?? uuid),
    email: raw.email ?? null,
    role: (raw.role ?? "Office") as import("@shared/schema").UserRole,
    userType: (raw.userType ?? raw.user_type ?? "Office") as "Office" | "Ship",
    vesselId: raw.vesselId ?? null,
    department: raw.department ?? null,
    isActive: raw.isActive !== false,
    crewDesignation: raw.crewDesignation ?? undefined,
    rank_name: raw.rank_name ?? raw.rankName ?? raw.rank ?? undefined,
    userUuid: uuid,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  } as import("@shared/schema").PublicUser;
}

function assignmentUuid(value: any): string {
  if (typeof value === "string") return value;
  return String(
    value?.vuuid ??
      value?.vesselUuid ??
      value?.vessel_id ??
      value?.vesselId ??
      value?.id ??
      "",
  );
}

function resolverFor(user: TestUserRecord): unknown {
  return user.resolverResults ?? user.resolverResult ?? user.resolver ?? null;
}

function resolverRows(value: unknown): Array<{
  vesselVuuid: string;
  resolvedRoleIds: string[];
  resolves: boolean;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: any) => ({
      vesselVuuid: String(entry?.vesselVuuid ?? ""),
      resolvedRoleIds: Array.isArray(entry?.resolvedRoleIds)
        ? entry.resolvedRoleIds.map(String)
        : [],
      resolves: entry?.resolves === true,
    }))
    .filter((entry) => entry.vesselVuuid);
}

export function RoleSwitcher() {
  const { uiRole, setUIRole } = useUIRole();
  const {
    currentUser,
    isTestIdentityActive,
    impersonateTestUser,
    resetTestUser,
  } = useAuth();
  const queryClient = useQueryClient();
  const capability = useQuery<any>({
    queryKey: [TEST_USERS_URL],
    enabled: isReplit(),
  });
  const [selectedUuid, setSelectedUuid] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [checkedVessels, setCheckedVessels] = React.useState<string[]>([]);
  const [liveResolver, setLiveResolver] = React.useState<unknown>(null);

  const users = React.useMemo(() => listFromPayload(capability.data), [capability.data]);
  const workflowStatuses = React.useMemo(
    () => workflowStatusesFromPayload(capability.data),
    [capability.data],
  );
  const workflowUsages = React.useMemo(
    () => workflowStatuses.flatMap((status) => status.usages),
    [workflowStatuses],
  );
  const rolesUsedInDefects = React.useMemo(
    () => new Set(
      workflowUsages
        .map((usage) => usage.assignedRole)
        .filter((role): role is string => !!role),
    ),
    [workflowUsages],
  );
  const duplicateCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      const key = normalizedDuplicateKey(user);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [users]);
  const sortedUsers = React.useMemo(
    () => users.slice().sort((left, right) =>
      compareExactRoleStrings(exactUserRole(left) || "\uffff", exactUserRole(right) || "\uffff") ||
      compareText(userName(left), userName(right)) ||
      compareText(userDisambiguator(left), userDisambiguator(right)) ||
      compareText(userUuid(left), userUuid(right)),
    ),
    [users],
  );
  const availableRoles = React.useMemo(
    () => Array.from(new Set(users.map(exactUserRole).filter(Boolean))).sort(compareExactRoleStrings),
    [users],
  );
  const filteredUsers = React.useMemo(
    () => roleFilter
      ? sortedUsers.filter((user) => userMatchesResolverRole(user, roleFilter))
      : sortedUsers,
    [roleFilter, sortedUsers],
  );
  const selectedRaw = users.find((user) => userUuid(user) === selectedUuid);
  const selectedRoleUsages = selectedRaw
    ? workflowUsages.filter((usage) => usage.assignedRole === exactUserRole(selectedRaw))
    : [];
  const roleMismatches = workflowUsages.filter((usage) => !usage.roleStringsMatch);
  const capabilityAvailable =
    isReplit() && capability.isSuccess && capability.data?.enabled !== false;
  const resolutionUrl = selectedUuid
    ? `${TEST_USERS_URL}/${encodeURIComponent(selectedUuid)}/resolution`
    : "";
  const resolutionQuery = useQuery<any>({
    queryKey: [resolutionUrl],
    enabled: capabilityAvailable && !!selectedUuid,
  });
  const activeVessels = React.useMemo(() => {
    const raw =
      capability.data?.activeVessels ??
      capability.data?.vessels ??
      capability.data?.data?.activeVessels ??
      capability.data?.data?.vessels ??
      selectedRaw?.assignments ??
      selectedRaw?.assignedVessels ??
      selectedRaw?.vessels ??
      [];
    return (Array.isArray(raw) ? raw : [])
      .map(
        (v: any): VesselRecord => ({
          vuuid: assignmentUuid(v),
          name: String(v?.name ?? v?.vesselName ?? v?.vessel ?? assignmentUuid(v)),
        }),
      )
      .filter((v) => v.vuuid);
  }, [capability.data, selectedRaw]);
  const assignedVessels = React.useMemo(() => {
    const raw =
      selectedRaw?.assignments ??
      selectedRaw?.assignedVessels ??
      selectedRaw?.vessels ??
      [];
    return new Set((Array.isArray(raw) ? raw : []).map(assignmentUuid).filter(Boolean));
  }, [selectedRaw]);

  React.useEffect(() => {
    if (!capability.isSuccess || capability.data?.enabled === false) {
      if (isTestIdentityActive) resetTestUser();
      setSelectedUuid("");
      return;
    }
    if (isTestIdentityActive && !selectedUuid && currentUser?.userUuid) {
      const activeIdentity = users.find(
        (user) => userUuid(user) === currentUser.userUuid,
      );
      if (activeIdentity) {
        setSelectedUuid(currentUser.userUuid);
        if (!roleFilter) setRoleFilter(exactUserRole(activeIdentity));
        return;
      }
    }
    if (!isTestIdentityActive && selectedUuid) {
      setSelectedUuid("");
      return;
    }
    if (selectedRaw && roleFilter && !userMatchesResolverRole(selectedRaw, roleFilter)) {
      resetTestUser();
      setSelectedUuid("");
      return;
    }
    if (selectedUuid && !selectedRaw) setSelectedUuid("");
  }, [
    capability.isSuccess,
    capability.data,
    currentUser?.userUuid,
    users,
    selectedRaw,
    selectedUuid,
    roleFilter,
    isTestIdentityActive,
    resetTestUser,
  ]);

  React.useEffect(() => {
    if (!selectedRaw) {
      setCheckedVessels([]);
      setLiveResolver(null);
      return;
    }
    setCheckedVessels(Array.from(assignedVessels));
    setLiveResolver(resolutionQuery.data?.resolverResults ?? resolverFor(selectedRaw));
  }, [selectedRaw, assignedVessels, resolutionQuery.data]);

  const assignmentMutation = useMutation({
    mutationFn: async ({ vuuid, remove }: { vuuid: string; remove: boolean }) => {
      if (!selectedUuid) throw new Error("Select a test user first");
      const url = `${TEST_USERS_URL}/${encodeURIComponent(selectedUuid)}/vessels`;
      const response = await apiRequest(
        remove ? "DELETE" : "POST",
        remove ? `${url}/${encodeURIComponent(vuuid)}` : url,
        remove ? undefined : { vuuid },
      );
      return response.json().catch(() => null);
    },
    onSuccess: (result) => {
      if (
        result?.resolverResults !== undefined ||
        result?.resolverResult !== undefined ||
        result?.resolver !== undefined
      ) {
        setLiveResolver(
          result.resolverResults ?? result.resolverResult ?? result.resolver,
        );
      }
      void queryClient.invalidateQueries({ queryKey: [TEST_USERS_URL] });
      if (resolutionUrl) {
        void queryClient.invalidateQueries({ queryKey: [resolutionUrl] });
      }
    },
    onError: () => {
      // The database is authoritative. Refetch both views so a failed write can
      // never leave a checkbox or resolver result implying that it succeeded.
      void queryClient.invalidateQueries({ queryKey: [TEST_USERS_URL] });
      if (resolutionUrl) {
        void queryClient.invalidateQueries({ queryKey: [resolutionUrl] });
      }
    },
  });

  const selectUser = (uuid: string) => {
    setSelectedUuid(uuid);
    if (!uuid) {
      resetTestUser();
      return;
    }
    const raw = users.find((user) => userUuid(user) === uuid);
    if (raw) impersonateTestUser(toPublicUser(raw));
  };

  const selectRoleFilter = (role: string) => {
    setRoleFilter(role);
    if (selectedRaw && role && !userMatchesResolverRole(selectedRaw, role)) {
      selectUser("");
    }
  };

  const toggleVessel = (vuuid: string, checked: boolean) => {
    assignmentMutation.mutate({ vuuid, remove: !checked });
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              data-testid="button-role-switcher"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-gray-900 text-white">
          <p>{uiRole ? UI_ROLE_LABELS[uiRole] : "Loading..."}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="max-h-[80vh] w-[360px] overflow-y-auto"
      >
        {VISIBLE_UI_ROLES.map((role) => (
          <DropdownMenuItem
            key={role}
            className={`flex items-center justify-between ${
              uiRole === role
                ? "cursor-default font-medium"
                : isReplit()
                  ? "cursor-pointer"
                  : "cursor-default opacity-50"
            }`}
            data-testid={`menu-role-${role.toLowerCase().replace("_", "-")}`}
            onSelect={(event) => {
              if (!isReplit()) {
                event.preventDefault();
                return;
              }
              setUIRole(role);
            }}
          >
            <span>{UI_ROLE_LABELS[role]}</span>
            {uiRole === role && <Check className="h-4 w-4 text-green-600" />}
          </DropdownMenuItem>
        ))}
        {capabilityAvailable && (
          <div
            className="my-1 border-t px-2 pt-2"
            onPointerDown={(event) => event.stopPropagation()}
            data-testid="test-identity-switcher"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Replit test identity
            </div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              Role filter
              <select
                className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-sm font-normal"
                value={roleFilter}
                onChange={(event) => selectRoleFilter(event.target.value)}
                data-testid="select-test-user-role-filter"
              >
                <option value="">All roles</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <select
              className="h-9 w-full rounded-md border bg-white px-2 text-sm"
              value={selectedUuid}
              onChange={(event) => selectUser(event.target.value)}
              data-testid="select-test-user"
            >
              <option value="">Select a test user</option>
              {filteredUsers.map((user) => {
                const uuid = userUuid(user);
                const role = exactUserRole(user) || "No role";
                const duplicate = (duplicateCounts.get(normalizedDuplicateKey(user)) ?? 0) > 1;
                const usedInDefects = rolesUsedInDefects.has(role);
                return (
                  <option key={uuid} value={uuid}>
                    {userName(user)} — {role} — {normalizedUserType(user)} — {userDisambiguator(user, duplicate)}
                    {usedInDefects ? " — used in Defects" : ""}
                    {duplicate ? " — duplicate name" : ""}
                  </option>
                );
              })}
            </select>
            {roleMismatches.length > 0 && (
              <div
                className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-800"
                role="alert"
                data-testid="defects-role-mismatch-warning"
              >
                Approval role misconfiguration: a stored slot label does not match the
                resolver role. This can cause a zero-approver stall.
                {roleMismatches.map((usage) => (
                  <div key={`${usage.scopeScreenId}-${usage.classification}-${usage.stepNumber}-${usage.slotNumber}`}>
                    {usage.roleLabel} → resolver matches {usage.assignedRole ?? "missing role"}
                  </div>
                ))}
              </div>
            )}
            {workflowStatuses.length > 0 && (
              <div
                className="mt-2 max-h-40 space-y-1 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700"
                data-testid="defects-workflow-role-coverage"
              >
                <div className="font-semibold">Defects workflow role usage</div>
                {workflowStatuses.map((status) => (
                  <div key={`${status.scopeScreenId}-${status.classification}`}>
                    <span className="font-medium">
                      {status.scopeLabel} — {status.classification}:
                    </span>{" "}
                    {status.status === "no-active-workflow"
                      ? "no active workflow configured"
                      : status.status === "engine-unavailable"
                        ? "approval engine unavailable"
                        : status.usages.length === 0
                          ? "active workflow has no approval slots"
                          : status.usages.map((usage) =>
                              `${usage.assignedRole ?? "missing resolver role"} (step ${usage.stepNumber}, ${usage.matchingActiveUsers} matching users)`,
                            ).join(", ")}
                  </div>
                ))}
              </div>
            )}
            {selectedRaw && (
              <div className="mt-2 space-y-1 text-xs text-gray-700" data-testid="test-user-details">
                <div><b>Resolver role:</b> {exactUserRole(selectedRaw) || "—"}</div>
                <div><b>Type:</b> {normalizedUserType(selectedRaw)}</div>
                <div><b>Rank:</b> {String(selectedRaw.rank_name ?? selectedRaw.rankName ?? selectedRaw.rank ?? "—")}</div>
                <div><b>Assignments:</b> {checkedVessels.length}</div>
                <div
                  className="rounded bg-blue-50 p-2 text-blue-900"
                  data-testid="selected-test-user-defects-usage"
                >
                  <b>Defects usage:</b>
                  {selectedRoleUsages.length === 0 ? (
                    <div>Not used in an active Defects workflow.</div>
                  ) : (
                    selectedRoleUsages.map((usage) => (
                      <div key={`${usage.scopeScreenId}-${usage.classification}-${usage.stepNumber}-${usage.slotNumber}`}>
                        {usage.scopeLabel}, step {usage.stepNumber} — {usage.classification}
                        {" "}— {usage.matchingActiveUsers} matching users
                        {!usage.roleStringsMatch && (
                          <span className="font-semibold text-red-700">
                            {" "}— label “{usage.roleLabel}” differs from resolver “{usage.assignedRole ?? "missing"}”
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {assignmentMutation.isError && (
                  <div
                    className="rounded border border-red-200 bg-red-50 p-2 text-red-700"
                    role="alert"
                    data-testid="error-test-user-assignment"
                  >
                    Vessel assignment was not changed. Please try again.
                  </div>
                )}
                {activeVessels.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="font-semibold">Active vessels</div>
                    {activeVessels.map((vessel) => (
                      <label key={vessel.vuuid} className="flex items-center gap-2">
                        <Checkbox
                          checked={checkedVessels.includes(vessel.vuuid)}
                          onCheckedChange={(value) => toggleVessel(vessel.vuuid, value === true)}
                          disabled={assignmentMutation.isPending}
                          data-testid={`checkbox-vessel-${vessel.vuuid}`}
                        />
                        <span>{vessel.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {resolverRows(liveResolver).length > 0 && (
                  <div
                    className="mt-2 max-h-36 space-y-1 overflow-auto rounded bg-gray-100 p-2"
                    data-testid="test-user-resolver-results"
                  >
                    <div className="font-semibold">Live approver resolution</div>
                    {resolverRows(liveResolver).map((result) => {
                      const vessel = activeVessels.find(
                        (candidate) => candidate.vuuid === result.vesselVuuid,
                      );
                      return (
                        <div
                          key={result.vesselVuuid}
                          className="flex items-start justify-between gap-3"
                          data-testid={`resolution-vessel-${result.vesselVuuid}`}
                        >
                          <span>{vessel?.name ?? result.vesselVuuid}</span>
                          <span
                            className={
                              result.resolves
                                ? "font-semibold text-green-700"
                                : "text-gray-500"
                            }
                          >
                            {result.resolves
                              ? `Resolves (${result.resolvedRoleIds.length})`
                              : "Does not resolve"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isTestIdentityActive && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 h-8 w-full text-xs"
                    onClick={resetTestUser}
                    data-testid="button-reset-test-user"
                  >
                    Reset to signed-in user
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Mounted at the app root (outside the route switch), so it also covers
 * standalone routes such as /defects/edit/:id.
 */
export function TestIdentityBanner() {
  const { isTestIdentityActive, currentUser, resetTestUser } = useAuth();
  const capability = useQuery<any>({
    queryKey: [TEST_USERS_URL],
    enabled: isReplit(),
  });
  const available =
    isReplit() && capability.isSuccess && capability.data?.enabled !== false;

  React.useEffect(() => {
    if (
      (!isReplit() || capability.isError || capability.data?.enabled === false) &&
      isTestIdentityActive
    ) {
      resetTestUser();
    }
  }, [capability.isError, capability.data, isTestIdentityActive, resetTestUser]);

  if (!available || !isTestIdentityActive) return null;
  return (
    <div
      className="fixed inset-x-0 top-16 z-[100] flex min-h-10 items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 shadow-md"
      role="alert"
      data-testid="banner-test-identity"
    >
      <span>
        TEST IDENTITY ACTIVE — acting as{" "}
        {currentUser?.fullName ?? currentUser?.username} ({currentUser?.role ?? "—"}).
        {" "}Development environment only.
      </span>
      <Button
        type="button"
        variant="outline"
        className="h-7 border-amber-800 bg-amber-50 px-2 text-xs"
        onClick={resetTestUser}
        data-testid="button-reset-test-identity"
      >
        Return to default user
      </Button>
    </div>
  );
}