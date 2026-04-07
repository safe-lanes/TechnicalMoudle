import * as repo from './repository';

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
  let inserted = 0;
  let updated = 0;

  for (const rank of ranks) {
    const existing = await repo.getRankByRankId(rank.rankId);
    await repo.upsertRank({
      name: rank.name,
      category: rank.category || null,
      rankId: rank.rankId,
      label: rank.label || null,
      applicableToCompany: rank.applicableToCompany ?? true,
      isSystemRank: rank.isSystemRank ?? true,
      sortOrder: rank.sortOrder ?? null,
      isDeleted: false,
    });
    if (existing) updated++;
    else inserted++;
  }

  return { success: true, message: `Saved ${ranks.length} ranks`, inserted, updated };
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
  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const result = await repo.upsertOrgChartEntry({
      id: entry.id || undefined,
      rank: entry.rank || null,
      rankId: entry.rankId,
      parentRankId: entry.parentRankId || null,
      sortOrder: entry.sortOrder ?? 0,
      isDeleted: false,
    });
    if (entry.id && result && result.length > 0) updated++;
    else inserted++;
  }

  return { success: true, message: `Saved ${entries.length} org chart entries`, inserted, updated };
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
