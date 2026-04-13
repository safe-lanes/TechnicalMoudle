import * as repo from './repository';
import { getPostgresClient } from '../../postgresClient';
import { admAvailableRanks, admVesselOrgChart, vesselOrgChartNodes } from '@shared/schema';
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

export async function bulkSaveVesselOrgChartNodes(vesselId: string, nodes: any[]) {
  const postgres = getPostgresClient();
  if (!postgres) {
    const err: any = new Error("Database not available");
    err.statusCode = 503;
    throw err;
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
    const incomingUuids = new Set(nodes.filter(n => n.nodeUuid).map((n: any) => n.nodeUuid));

    for (const existingNode of existingNodes) {
      if (!incomingUuids.has(existingNode.nodeUuid)) {
        await tx.update(vesselOrgChartNodes)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(eq(vesselOrgChartNodes.nodeUuid, existingNode.nodeUuid));
      }
    }

    const updateNodes = nodes.filter((n: any) => n.nodeUuid && existingUuids.has(n.nodeUuid));
    const newNodes = nodes.filter((n: any) => !n.nodeUuid || !existingUuids.has(n.nodeUuid));

    for (const node of updateNodes) {
      const data = {
        vesselId,
        rankId: node.rankId,
        nodeLabel: node.nodeLabel || null,
        department: node.department || null,
        parentNodeUuid: node.parentNodeUuid || null,
        isHod: node.isHod ?? false,
        isAssigned: node.isAssigned ?? false,
        viewMode: node.viewMode || null,
        sortOrder: node.sortOrder ?? 0,
        isDeleted: false,
      };
      await tx.update(vesselOrgChartNodes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(vesselOrgChartNodes.nodeUuid, node.nodeUuid));
      updated++;
    }

    const newUuids = new Set(newNodes.map((n: any) => n.nodeUuid).filter(Boolean));
    const roots = newNodes.filter((n: any) => !n.parentNodeUuid || !newUuids.has(n.parentNodeUuid));
    const children = newNodes.filter((n: any) => n.parentNodeUuid && newUuids.has(n.parentNodeUuid));
    const orderedNew = [...roots, ...children];

    for (const node of orderedNew) {
      const data = {
        vesselId,
        rankId: node.rankId,
        nodeLabel: node.nodeLabel || null,
        department: node.department || null,
        parentNodeUuid: node.parentNodeUuid || null,
        isHod: node.isHod ?? false,
        isAssigned: node.isAssigned ?? false,
        viewMode: node.viewMode || null,
        sortOrder: node.sortOrder ?? 0,
        isDeleted: false,
      };
      const insertData: any = { ...data };
      if (node.nodeUuid) {
        insertData.nodeUuid = node.nodeUuid;
      }
      await tx.insert(vesselOrgChartNodes).values(insertData);
      inserted++;
    }

    return { success: true, inserted, updated, total: nodes.length };
  });
}

export async function unassignVesselOrgChartNode(nodeUuid: string) {
  const node = await repo.getVesselOrgChartNodeByUuid(nodeUuid);
  if (!node) {
    const err: any = new Error("Node not found");
    err.statusCode = 404;
    throw err;
  }
  const result = await repo.updateVesselOrgChartNode(nodeUuid, {
    isAssigned: false,
    department: null,
    parentNodeUuid: null,
    isHod: false,
  });
  return { success: true, node: result };
}

export async function deleteVesselOrgChartNode(nodeUuid: string) {
  const node = await repo.getVesselOrgChartNodeByUuid(nodeUuid);
  if (!node) {
    const err: any = new Error("Node not found");
    err.statusCode = 404;
    throw err;
  }
  await repo.softDeleteVesselOrgChartNode(nodeUuid);
  return { success: true, message: `Node ${nodeUuid} deleted` };
}
