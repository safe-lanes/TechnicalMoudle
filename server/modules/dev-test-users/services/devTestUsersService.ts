import { NotFoundError } from '../../shared/errors';
import { resolveRoleApproverUserIds } from '../../approvals/approvalCard';
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
}

export async function getUsersSnapshot(): Promise<DevTestUsersSnapshot> {
  const [users, assignments, vessels, roles] = await Promise.all([
    repository.getActiveUsers(),
    repository.getActiveAssignments(),
    repository.getActiveVessels(),
    repository.getActiveApprovalRoles(),
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