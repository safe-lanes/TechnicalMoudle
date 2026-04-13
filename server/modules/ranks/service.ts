import * as repo from './repository';
import { getPostgresClient } from '../../postgresClient';
import { admAvailableRanks, admVesselOrgChart, vesselOrgChartNodes, masterLists } from '@shared/schema';
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

export async function createVesselOrgChartNode(vesselId: string, rankId: string, nodeLabel?: string) {
  const node = await repo.createVesselOrgChartNode({
    vesselId,
    rankId,
    nodeLabel: nodeLabel || null,
    department: null,
    parentNodeUuid: null,
    isHod: false,
    isAssigned: false,
    viewMode: null,
    sortOrder: 0,
    isDeleted: false,
  });
  if (!node) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
  }
  return node;
}

interface OrgNodePayload {
  nodeUuid?: string;
  rankId: string;
  nodeLabel?: string | null;
  department?: string | null;
  parentNodeUuid?: string | null;
  isHod?: boolean;
  isAssigned?: boolean;
  viewMode?: string | null;
  sortOrder?: number;
  nodeLayer?: string;
}

function createHttpError(message: string, statusCode: number): Error {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function toNodeData(vesselId: string, node: OrgNodePayload) {
  return {
    vesselId,
    rankId: node.rankId,
    nodeLabel: node.nodeLabel || null,
    department: node.department || null,
    parentNodeUuid: node.parentNodeUuid || null,
    isHod: node.isHod ?? false,
    isAssigned: node.isAssigned ?? false,
    viewMode: node.viewMode || null,
    sortOrder: node.sortOrder ?? 0,
    nodeLayer: node.nodeLayer || 'department',
    isDeleted: false,
  };
}

export async function bulkSaveVesselOrgChartNodes(vesselId: string, nodes: OrgNodePayload[]) {
  const postgres = getPostgresClient();
  if (!postgres) throw createHttpError("Database not available", 503);

  const nodeMap = new Map<string, OrgNodePayload>();
  for (const n of nodes) {
    if (n.nodeUuid) nodeMap.set(n.nodeUuid, n);
  }

  const hodPerDept = new Map<string, number>();
  for (const n of nodes) {
    const layer = n.nodeLayer || 'department';
    if (n.isAssigned && !n.department && layer === 'department') {
      throw createHttpError(
        `Node ${n.nodeUuid || 'new'} is marked as assigned but has no department`,
        400
      );
    }
    if (n.parentNodeUuid && nodeMap.has(n.parentNodeUuid)) {
      const parent = nodeMap.get(n.parentNodeUuid)!;
      const parentLayer = parent.nodeLayer || 'department';
      if (layer === 'department' && parentLayer === 'department' && parent.department !== n.department) {
        throw createHttpError(
          `Cross-department parent reference: node ${n.nodeUuid} (dept: ${n.department}) references parent ${n.parentNodeUuid} (dept: ${parent.department})`,
          400
        );
      }
    }
    if (n.isHod && n.department) {
      hodPerDept.set(n.department, (hodPerDept.get(n.department) || 0) + 1);
    }
  }
  for (const [dept, count] of hodPerDept) {
    if (count > 1) {
      throw createHttpError(`Multiple HOD nodes in department "${dept}": only one HOD is allowed per department`, 400);
    }
  }

  return postgres.db.transaction(async (tx) => {
    let inserted = 0;
    let updated = 0;

    const existingNodes = await tx.select().from(vesselOrgChartNodes)
      .where(and(
        eq(vesselOrgChartNodes.vesselId, vesselId),
        eq(vesselOrgChartNodes.isDeleted, false)
      ));

    const existingUuids = new Set(existingNodes.map(n => n.nodeUuid));
    const incomingUuids = new Set(nodes.filter(n => n.nodeUuid).map(n => n.nodeUuid!));
    const allValidUuids = new Set([...existingUuids, ...incomingUuids]);

    for (const n of nodes) {
      if (n.parentNodeUuid && !allValidUuids.has(n.parentNodeUuid)) {
        throw createHttpError(
          `Invalid parent reference: node ${n.nodeUuid} references parent ${n.parentNodeUuid} which does not exist in this vessel`,
          400
        );
      }
    }

    for (const existingNode of existingNodes) {
      if (!incomingUuids.has(existingNode.nodeUuid)) {
        await tx.update(vesselOrgChartNodes)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(eq(vesselOrgChartNodes.nodeUuid, existingNode.nodeUuid));
      }
    }

    const updateNodes = nodes.filter(n => n.nodeUuid && existingUuids.has(n.nodeUuid));
    const newNodes = nodes.filter(n => !n.nodeUuid || !existingUuids.has(n.nodeUuid));

    for (const node of updateNodes) {
      const dataWithoutParent = { ...toNodeData(vesselId, node), parentNodeUuid: null, updatedAt: new Date() };
      await tx.update(vesselOrgChartNodes)
        .set(dataWithoutParent)
        .where(eq(vesselOrgChartNodes.nodeUuid, node.nodeUuid!));
      updated++;
    }

    for (const node of newNodes) {
      const data = { ...toNodeData(vesselId, node), parentNodeUuid: null };
      const insertData = node.nodeUuid ? { ...data, nodeUuid: node.nodeUuid } : data;
      await tx.insert(vesselOrgChartNodes).values(insertData);
      inserted++;
    }

    for (const node of nodes) {
      if (node.parentNodeUuid && node.nodeUuid) {
        await tx.update(vesselOrgChartNodes)
          .set({ parentNodeUuid: node.parentNodeUuid })
          .where(eq(vesselOrgChartNodes.nodeUuid, node.nodeUuid));
      }
    }

    return { success: true, inserted, updated, total: nodes.length };
  });
}

export async function unassignVesselOrgChartNode(vesselId: string, nodeUuid: string) {
  const node = await repo.getVesselOrgChartNodeByUuid(nodeUuid);
  if (!node) throw createHttpError("Node not found", 404);
  if (node.vesselId !== vesselId) throw createHttpError("Node does not belong to this vessel", 403);
  const result = await repo.updateVesselOrgChartNode(nodeUuid, {
    isAssigned: false,
    department: null,
    parentNodeUuid: null,
    isHod: false,
  });
  return { success: true, node: result };
}

export async function deleteVesselOrgChartNode(vesselId: string, nodeUuid: string) {
  const node = await repo.getVesselOrgChartNodeByUuid(nodeUuid);
  if (!node) throw createHttpError("Node not found", 404);
  if (node.vesselId !== vesselId) throw createHttpError("Node does not belong to this vessel", 403);
  await repo.softDeleteVesselOrgChartNode(nodeUuid);
  return { success: true, message: `Node ${nodeUuid} deleted` };
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

export async function saveVesselDepartmentConfig(vesselId: string, configs: { department: string; isEnabled: boolean; sortOrder: number }[]) {
  if (!vesselId) throw createHttpError("vesselId required", 400);
  if (!Array.isArray(configs)) throw createHttpError("configs array required", 400);
  const result = await repo.upsertVesselDepartmentConfig(vesselId, configs);
  return { success: true, configs: result };
}

export async function resolveHierarchyScope(vesselId: string, crewDesignation: string) {
  if (!vesselId) throw createHttpError("vesselId required", 400);
  if (!crewDesignation) throw createHttpError("crewDesignation required", 400);

  const allRanks = await repo.getAllRanks();
  if (!allRanks) throw createHttpError("Database not available", 503);

  const nodes = await repo.getVesselOrgChartNodes(vesselId);
  if (!nodes || nodes.length === 0) {
    return { vesselId, hasMapping: false, me: { nodeUuids: [], assignmentKeys: [] }, myTeam: { nodeUuids: [], assignmentKeys: [] } };
  }

  const designationLower = crewDesignation.toLowerCase().trim();
  const matchingRanks = allRanks.filter(r =>
    r.name?.toLowerCase().trim() === designationLower ||
    r.label?.toLowerCase().trim() === designationLower
  );

  if (matchingRanks.length === 0) {
    return { vesselId, hasMapping: false, me: { nodeUuids: [], assignmentKeys: [] }, myTeam: { nodeUuids: [], assignmentKeys: [] } };
  }

  const matchingRankIds = new Set(matchingRanks.map(r => r.rankId));

  const assignedNodes = nodes.filter(n => n.isAssigned);
  const meNodes = assignedNodes.filter(n => matchingRankIds.has(n.rankId));

  if (meNodes.length === 0) {
    return { vesselId, hasMapping: false, me: { nodeUuids: [], assignmentKeys: [] }, myTeam: { nodeUuids: [], assignmentKeys: [] } };
  }

  const rankIdToLabels = new Map<string, string[]>();
  for (const r of allRanks) {
    const labels = [r.name, r.label].filter(Boolean) as string[];
    rankIdToLabels.set(r.rankId, labels);
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
  const meLabels = new Set<string>();
  for (const rid of meRankIds) {
    for (const l of (rankIdToLabels.get(rid) || [])) meLabels.add(l);
  }

  const teamUuids = collectDescendants(meUuids);
  const teamRankIds = new Set<string>();
  for (const uuid of teamUuids) {
    const node = nodeByUuid.get(uuid);
    if (node) teamRankIds.add(node.rankId);
  }
  const teamLabels = new Set<string>();
  for (const rid of teamRankIds) {
    for (const l of (rankIdToLabels.get(rid) || [])) teamLabels.add(l);
  }

  return {
    vesselId,
    hasMapping: true,
    me: { nodeUuids: meUuids, assignmentKeys: Array.from(meLabels) },
    myTeam: { nodeUuids: Array.from(teamUuids), assignmentKeys: Array.from(teamLabels) },
  };
}
