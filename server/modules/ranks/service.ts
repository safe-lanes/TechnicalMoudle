import * as repo from './repository';
import { getPostgresClient } from '../../postgresClient';
import { admAvailableRanks, admVesselOrgChart, masterLists } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function getAllRanks() {
  const ranks = await repo.getAllRanks();
  if (!ranks) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }
  return ranks;
}

export async function getRankByRankId(rankId: string) {
  const rank = await repo.getRankByRankId(rankId);
  if (!rank) {
    const err: any = new Error("Rank not found");
    err.statusCode = 404;
    throw err;
  }
  return rank;
}

export async function saveRanks(ranks: any[]) {
  const postgres = getPostgresClient();
  if (!postgres) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }

  return postgres.db.transaction(async (tx) => {
    let inserted = 0;
    let updated = 0;

    for (const rank of ranks) {
      const existing = await tx.select().from(admAvailableRanks)
        .where(eq(admAvailableRanks.rankId, rank.rankId))
        .limit(1);

      const data = {
        name: rank.name,
        category: rank.category || null,
        rankId: rank.rankId,
        label: rank.label || null,
        applicableToCompany: rank.applicableToCompany ?? true,
        isSystemRank: rank.isSystemRank ?? true,
        sortOrder: rank.sortOrder ?? null,
        viewMode: rank.viewMode || null,
        isDeleted: false,
      };

      if (existing.length > 0) {
        await tx.update(admAvailableRanks)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(admAvailableRanks.rankId, rank.rankId));
        updated++;
      } else {
        await tx.insert(admAvailableRanks).values(data);
        inserted++;
      }
    }

    return { success: true, message: `Saved ${ranks.length} ranks`, inserted, updated };
  });
}

export async function updateRank(rankId: string, data: any) {
  const existing = await repo.getRankByRankId(rankId);
  if (!existing) {
    const err: any = new Error("Rank not found");
    err.statusCode = 404;
    throw err;
  }
  const result = await repo.upsertRank({
    name: data.name ?? existing.name,
    category: data.category ?? existing.category,
    rankId,
    label: data.label ?? existing.label,
    applicableToCompany: data.applicableToCompany ?? existing.applicableToCompany,
    isSystemRank: data.isSystemRank ?? existing.isSystemRank,
    sortOrder: data.sortOrder ?? existing.sortOrder,
    viewMode: data.viewMode !== undefined ? (data.viewMode || null) : existing.viewMode,
    isDeleted: false,
  });
  return { success: true, rank: result?.[0] || null };
}

export async function deleteRank(rankId: string) {
  const rank = await repo.getRankByRankId(rankId);
  if (!rank) {
    const err: any = new Error("Rank not found");
    err.statusCode = 404;
    throw err;
  }
  if (rank.isSystemRank) {
    const err: any = new Error("Cannot delete system-defined rank");
    err.statusCode = 403;
    throw err;
  }
  await repo.softDeleteRank(rankId);
  return { success: true, message: `Rank ${rankId} deleted` };
}

export async function getAllOrgChart() {
  const chart = await repo.getAllOrgChart();
  if (!chart) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }
  return chart;
}

export async function getOrgChartById(id: number) {
  const entry = await repo.getOrgChartById(id);
  if (!entry) {
    const err: any = new Error("Org chart entry not found");
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

export async function saveOrgChart(entries: any[]) {
  const postgres = getPostgresClient();
  if (!postgres) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }

  return postgres.db.transaction(async (tx) => {
    let inserted = 0;
    let updated = 0;

    for (const entry of entries) {
      const data = {
        rank: entry.rank || null,
        rankId: entry.rankId,
        parentRankId: entry.parentRankId || null,
        sortOrder: entry.sortOrder ?? 0,
        isDeleted: false,
        rankView: entry.rankView || null,
      };

      if (entry.id) {
        const existing = await tx.select().from(admVesselOrgChart)
          .where(eq(admVesselOrgChart.id, entry.id))
          .limit(1);

        if (existing.length > 0) {
          await tx.update(admVesselOrgChart)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(admVesselOrgChart.id, entry.id));
          updated++;
          continue;
        }
      }

      await tx.insert(admVesselOrgChart).values(data);
      inserted++;
    }

    return { success: true, message: `Saved ${entries.length} org chart entries`, inserted, updated };
  });
}

export async function updateOrgChartEntry(id: number, data: any) {
  const existing = await repo.getOrgChartById(id);
  if (!existing) {
    const err: any = new Error("Org chart entry not found");
    err.statusCode = 404;
    throw err;
  }
  const result = await repo.upsertOrgChartEntry({
    id,
    rank: data.rank ?? existing.rank,
    rankId: data.rankId ?? existing.rankId,
    parentRankId: data.parentRankId ?? existing.parentRankId,
    sortOrder: data.sortOrder ?? existing.sortOrder,
    isDeleted: false,
  });
  return { success: true, entry: result?.[0] || null };
}

export async function deleteOrgChartEntry(id: number) {
  const entry = await repo.getOrgChartById(id);
  if (!entry) {
    const err: any = new Error("Org chart entry not found");
    err.statusCode = 404;
    throw err;
  }
  await repo.softDeleteOrgChartEntry(id);
  return { success: true, message: `Org chart entry ${id} deleted` };
}

export async function getVesselOrgChartNodes(vesselId: string) {
  const nodes = await repo.getVesselOrgChartNodes(vesselId);
  if (!nodes) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }
  return nodes;
}

function createHttpError(message: string, statusCode: number): Error {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export async function getVesselDepartmentConfig(vesselId: string) {
  if (!vesselId) throw createHttpError("vesselId required", 400);
  const configs = await repo.getVesselDepartmentConfig(vesselId);
  if (configs && configs.length > 0) return configs;

  const postgres = getPostgresClient();
  if (!postgres) return [];
  const depts = await postgres.db.select().from(masterLists).where(
    and(eq(masterLists.listType, 'department'), eq(masterLists.isActive, true))
  );
  return depts.map((d: any, i: number) => ({
    vesselId,
    department: d.listValue,
    isEnabled: true,
    sortOrder: d.displayOrder ?? i,
  }));
}

export async function resolveHierarchyScope(vesselId: string, crewDesignation: string) {
  if (!vesselId) throw createHttpError("vesselId required", 400);
  if (!crewDesignation) throw createHttpError("crewDesignation required", 400);

  const allRanks = await repo.getAllRanks();
  if (!allRanks) throw createHttpError("Database not available", 503);

  const designationLower = crewDesignation.toLowerCase().trim();
  const matchingRanks = allRanks.filter(r =>
    r.name?.toLowerCase().trim() === designationLower ||
    r.label?.toLowerCase().trim() === designationLower
  );

  if (matchingRanks.length === 0) {
    return { vesselId, hasMapping: false, hasDescendants: false, me: { nodeUuids: [], rankIds: [] }, myTeam: { nodeUuids: [], rankIds: [] } };
  }

  const matchingRankIds = matchingRanks.map(r => r.rankId);
  return resolveHierarchyScopeByRankId(vesselId, matchingRankIds[0]);
}

export async function resolveHierarchyScopeByRankId(vesselId: string, userRankId: string) {
  if (!vesselId) throw createHttpError("vesselId required", 400);
  if (!userRankId) throw createHttpError("rankId required", 400);

  const nodes = await repo.getVesselOrgChartNodes(vesselId);
  if (!nodes || nodes.length === 0) {
    return { vesselId, hasMapping: false, hasDescendants: false, me: { nodeUuids: [], rankIds: [] }, myTeam: { nodeUuids: [], rankIds: [] } };
  }

  const assignedNodes = nodes.filter(n => n.isAssigned);
  const meNodes = assignedNodes.filter(n => n.rankId === userRankId);

  if (meNodes.length === 0) {
    return { vesselId, hasMapping: false, hasDescendants: false, me: { nodeUuids: [], rankIds: [] }, myTeam: { nodeUuids: [], rankIds: [] } };
  }

  const nodeByUuid = new Map(assignedNodes.map(n => [n.nodeUuid, n]));
  const childrenMap = new Map<string, typeof assignedNodes>();
  for (const n of assignedNodes) {
    if (n.parentNodeUuid) {
      const list = childrenMap.get(n.parentNodeUuid) || [];
      list.push(n);
      childrenMap.set(n.parentNodeUuid, list);
    }
  }

  function collectDescendants(rootUuids: string[]): Set<string> {
    const visited = new Set<string>();
    const queue = [...rootUuids];
    while (queue.length > 0) {
      const uuid = queue.pop()!;
      if (visited.has(uuid)) continue;
      visited.add(uuid);
      const children = childrenMap.get(uuid) || [];
      for (const child of children) {
        queue.push(child.nodeUuid);
      }
    }
    return visited;
  }

  const meUuids = meNodes.map(n => n.nodeUuid);
  const meRankIds = new Set(meNodes.map(n => n.rankId));

  const teamUuids = collectDescendants(meUuids);
  const teamRankIds = new Set<string>();
  for (const uuid of teamUuids) {
    const node = nodeByUuid.get(uuid);
    if (node) teamRankIds.add(node.rankId);
  }

  const hasDescendants = teamUuids.size > meUuids.length;

  return {
    vesselId,
    hasMapping: true,
    hasDescendants,
    me: { nodeUuids: meUuids, rankIds: Array.from(meRankIds) },
    myTeam: { nodeUuids: Array.from(teamUuids), rankIds: Array.from(teamRankIds) },
  };
}

