import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface RankApiRow {
  id?: number;
  rankId?: string;
  rank_id?: string;
  name: string;
  label?: string | null;
  category?: string | null;
  sortOrder?: number | null;
  sort_order?: number | null;
  isDeleted?: boolean;
  is_deleted?: boolean;
}

export interface RankOption {
  value: string;
  label: string;
}

export function useRanks() {
  const query = useQuery<RankApiRow[]>({
    queryKey: ['/technical/api/admin/available-ranks'],
    staleTime: 5 * 60 * 1000,
  });

  const ranks = useMemo<RankOption[]>(() => {
    const rows = Array.isArray(query.data) ? query.data : [];
    return rows
      .filter((r) => !(r.isDeleted ?? r.is_deleted))
      .filter((r) => !!r.name)
      .map((r) => ({
        value: r.name,
        label: (r.label && r.label.trim()) ? r.label : r.name,
        sortOrder: r.sortOrder ?? r.sort_order ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ value, label }) => ({ value, label }));
  }, [query.data]);

  return { ranks, isLoading: query.isLoading, isError: query.isError };
}

export function getRankLabel(ranks: RankOption[], value?: string | null): string {
  if (!value) return "";
  const match = ranks.find((r) => r.value === value);
  return match?.label || value;
}

export function ensureRankInOptions(ranks: RankOption[], value?: string | null): RankOption[] {
  if (!value) return ranks;
  if (ranks.some((r) => r.value === value)) return ranks;
  return [...ranks, { value, label: value }];
}
