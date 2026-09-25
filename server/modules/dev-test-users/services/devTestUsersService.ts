import { NotFoundError } from '../../shared/errors';
import { resolveRoleApproverUserIds } from '../../approvals/approvalCard';
import {
  activeWorkflowScoped,
  isApprovalEngineAvailable,
  scopeFor,
} from '../../approvals/engineGateway';
import {
  DEFECTS_MODULE_ID,
  defectsApprovalCard,
} from '../../defects/approvalCard';
import * as repository from '../repositories/devTestUsersRepository';

export interface DevTestUserResolution {
  vesselVuuid: string;
  resolvedRoleIds: string[];
  resolves: boolean;
}

export interface DevTestUsersSnapshot {
  users: Array<repository.DevTestUserRow & {
    assignments: Array<{ vuuid: string; name: string }>;
  }>;
  assignments: repository.DevTestAssignmentRow[];
  vessels: repository.DevTestVesselRow[];
  roles: repository.DevTestRoleRow[];
  defectsWorkflowRoles: DevTestDefectsWorkflowStatus[];
}

export interface DevTestDefectsRoleUsage {
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

export interface DevTestDefectsWorkflowStatus {
  scopeScreenId: string;
  scopeLabel: string;
  classification: string;
  status: 'active' | 'no-active-workflow' | 'engine-unavailable';
  usages: DevTestDefectsRoleUsage[];
}

async function getDefectsWorkflowRoles(
  users: repository.DevTestUserRow[],
  roleDefinitions: repository.DevTestResolverRoleRow[],
): Promise<DevTestDefectsWorkflowStatus[]> {
  const engineAvailable = isApprovalEngineAvailable();
  const combinations = defectsApprovalCard.scopes.flatMap((scope) =>
    scope.classifications.map((classification) => ({
      scopeScreenId: scope.screenId,
      scopeLabel: scope.label,
      classification: classification.id,
    })),
  );
  const workflows = engineAvailable
    ? await Promise.all(combinations.map((entry) =>
        activeWorkflowScoped(
          scopeFor(DEFECTS_MODULE_ID, entry.scopeScreenId),
          entry.classification,
        ),
      ))
    : combinations.map(() => null);
  const roleById = new Map(roleDefinitions.map((role) => [role.roleId, role]));

  return combinations.map((entry, index) => {
    const workflow = workflows[index];
    if (!engineAvailable) {
      return { ...entry, status: 'engine-unavailable' as const, usages: [] };
    }
    if (!workflow) {
      return { ...entry, status: 'no-active-workflow' as const, usages: [] };
    }
    const usages: DevTestDefectsRoleUsage[] = [];
    const seen = new Set<string>();
    const steps = (workflow.nodes ?? [])
      .filter((node) => node.type === 'approval-step')
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);
    for (const step of steps) {
      const slots = step.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const slot = slots[slotIndex];
        const role = roleById.get(slot.roleId);
        const assignedRole = role?.roleName ?? null;
        const usage: DevTestDefectsRoleUsage = {
          roleId: slot.roleId,
          roleLabel: slot.roleLabel,
          assignedRole,
          roleStringsMatch: assignedRole !== null && slot.roleLabel === assignedRole,
          matchingActiveUsers: assignedRole === null
            ? 0
            : users.filter((user) => user.role === assignedRole).length,
          ...entry,
          stepNumber: step.ordinal + 1,
          stepLabel: step.label || `Step ${step.ordinal + 1}`,
          slotNumber: slotIndex + 1,
        };
        const key = [
          usage.scopeScreenId,
          usage.classification,
          usage.stepNumber,
          usage.slotNumber,
          usage.roleId,
          usage.roleLabel,
          usage.assignedRole ?? '',
        ].join('\u0000');
        if (!seen.has(key)) {
          seen.add(key);
          usages.push(usage);
        }
      }
    }
    return { ...entry, status: 'active' as const, usages };
  });
}

export async function getUsersSnapshot(): Promise<DevTestUsersSnapshot> {
  const [users, assignments, vessels, roles, roleDefinitions] = await Promise.all([
    repository.getActiveUsers(),
    repository.getActiveAssignments(),
    repository.getActiveVessels(),
    repository.getActiveApprovalRoles(),
    repository.getResolverRoleDefinitions(),
  ]);
  const byUser = new Map<string, Array<{ vuuid: string; name: string }>>();
  for (const assignment of assignments) {
    const existing = byUser.get(assignment.userId) ?? [];
    existing.push({ vuuid: assignment.vuuid, name: assignment.vesselName });
    byUser.set(assignment.userId, existing);
  }
  return {
    users: users.map((user) => ({
      ...user,
      assignments: byUser.get(user.id) ?? [],
    })),
    assignments,
    vessels,
    roles,
    defectsWorkflowRoles: await getDefectsWorkflowRoles(users, roleDefinitions),
  };
}

export async function getUserResolution(userId: string): Promise<{
  user: repository.DevTestUserRow;
  resolverResults: DevTestUserResolution[];
}> {
  const user = await repository.getActiveUser(userId);
  if (!user) {
    throw new NotFoundError('Active test user not found');
  }
  const [vessels, roles] = await Promise.all([
    repository.getActiveVessels(),
    user.role ? repository.getActiveApprovalRolesForName(user.role) : Promise.resolve([]),
  ]);
  const resolverResults = await Promise.all(vessels.map(async (vessel) => {
    const resolvedRoleIds: string[] = [];
    for (const role of roles) {
      const ids = await resolveRoleApproverUserIds(role.roleId, vessel.vuuid);
      if (ids.includes(user.id)) resolvedRoleIds.push(role.roleId);
    }
    return {
      vesselVuuid: vessel.vuuid,
      resolvedRoleIds,
      resolves: resolvedRoleIds.length > 0,
    };
  }));
  return { user, resolverResults };
}

export async function assignUserToVessel(userId: string, vuuid: string) {
  if (!(await repository.hasActiveUser(userId))) {
    throw new NotFoundError('Active test user not found');
  }
  if (!(await repository.getActiveVessel(vuuid))) {
    throw new NotFoundError('Active vessel not found');
  }
  await repository.upsertActiveAssignment(userId, vuuid);
  return getUserResolution(userId);
}

export async function removeUserFromVessel(userId: string, vuuid: string) {
  if (!(await repository.hasActiveUser(userId))) {
    throw new NotFoundError('Active test user not found');
  }
  if (!(await repository.getActiveVessel(vuuid))) {
    throw new NotFoundError('Active vessel not found');
  }
  await repository.deactivateAssignment(userId, vuuid);
  return getUserResolution(userId);
}