import { getPostgresClient } from '../../postgresClient';
import { admVesselOrgChart, admAvailableRanks, vesselOrgChartNodes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface HodResolution {
  resolved: boolean;
  rankName: string;
  rankId: string | null;
  department: string;
  source: 'org_chart' | 'stored_approver' | 'fallback';
  mismatch: boolean;
  mismatchDetails?: string;
}

export async function resolveHodForDepartment(
  vesselId: string | null | undefined,
  department: string | null | undefined,
  storedApprover?: string | null
): Promise<HodResolution> {
  const dept = (department || '').trim();

  if (!dept) {
    console.warn('[HOD Resolution] No department provided, using fallback');
    return buildFallback(dept, storedApprover);
  }

  const postgres = getPostgresClient();
  if (!postgres) {
    console.warn('[HOD Resolution] Database not available, using fallback');
    return buildFallback(dept, storedApprover);
  }

  const deptLower = dept.toLowerCase();

  if (vesselId) {
    const nodes = await postgres.db
      .select()
      .from(vesselOrgChartNodes)
      .where(
        and(
          eq(vesselOrgChartNodes.vesselId, vesselId),
          eq(vesselOrgChartNodes.isDeleted, false),
          eq(vesselOrgChartNodes.isAssigned, true)
        )
      );

    const hodNode = nodes.find(
      (n) =>
        n.isHod === true &&
        n.department &&
        n.department.toLowerCase() === deptLower
    );

    if (hodNode) {
      const rank = await postgres.db
        .select()
        .from(admAvailableRanks)
        .where(eq(admAvailableRanks.rankId, hodNode.rankId))
        .limit(1);

      const rankName = rank[0]?.name || hodNode.nodeLabel || hodNode.rankId;
      const result: HodResolution = {
        resolved: true,
        rankName,
        rankId: hodNode.rankId,
        department: dept,
        source: 'org_chart',
        mismatch: false,
      };

      if (storedApprover && storedApprover.toLowerCase() !== rankName.toLowerCase()) {
        result.mismatch = true;
        result.mismatchDetails = `Stored approver "${storedApprover}" differs from org chart HOD "${rankName}" for ${dept} department`;
        console.warn(`[HOD Resolution] ${result.mismatchDetails}`);
      }

      return result;
    }
  }

  const orgChartEntries = await postgres.db
    .select()
    .from(admVesselOrgChart)
    .where(eq(admVesselOrgChart.isDeleted, false));

  const hodEntry = orgChartEntries.find(
    (e) =>
      e.rankView === 'Head_of_Dept' &&
      e.department &&
      e.department.toLowerCase() === deptLower
  );

  if (hodEntry) {
    const rank = await postgres.db
      .select()
      .from(admAvailableRanks)
      .where(eq(admAvailableRanks.rankId, hodEntry.rankId))
      .limit(1);

    const rankName = rank[0]?.name || hodEntry.rank || hodEntry.rankId;
    const result: HodResolution = {
      resolved: true,
      rankName,
      rankId: hodEntry.rankId,
      department: dept,
      source: 'org_chart',
      mismatch: false,
    };

    if (storedApprover && storedApprover.toLowerCase() !== rankName.toLowerCase()) {
      result.mismatch = true;
      result.mismatchDetails = `Stored approver "${storedApprover}" differs from org chart HOD "${rankName}" for ${dept} department`;
      console.warn(`[HOD Resolution] ${result.mismatchDetails}`);
    }

    return result;
  }

  console.warn(`[HOD Resolution] No HOD found in org chart for department "${dept}" (vessel: ${vesselId || 'none'}), using fallback`);
  return buildFallback(dept, storedApprover);
}

function buildFallback(department: string, storedApprover?: string | null): HodResolution {
  if (storedApprover) {
    return {
      resolved: true,
      rankName: storedApprover,
      rankId: null,
      department,
      source: 'stored_approver',
      mismatch: false,
    };
  }

  const deptLower = (department || '').toLowerCase();
  let fallbackRank = 'Head of Dept';
  if (deptLower === 'engine' || deptLower === 'electrical') {
    fallbackRank = 'Chief Engineer';
  } else if (deptLower === 'deck' || deptLower === 'navigation') {
    fallbackRank = 'Chief Officer';
  }

  return {
    resolved: true,
    rankName: fallbackRank,
    rankId: null,
    department,
    source: 'fallback',
    mismatch: false,
  };
}

export function getHodShortLabel(rankName: string): string {
  const lower = rankName.toLowerCase();
  if (lower.includes('chief engineer')) return 'CE';
  if (lower.includes('chief officer')) return 'CO';
  if (lower === 'master' || lower === 'captain') return 'Master';
  const words = rankName.split(/\s+/);
  if (words.length >= 2) {
    return words.map((w) => w[0].toUpperCase()).join('');
  }
  return rankName;
}
