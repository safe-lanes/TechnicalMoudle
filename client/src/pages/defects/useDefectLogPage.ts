import { useState, useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Defect } from '@shared/schema';
import type { PeriodValue } from '@/components/filters/PeriodPicker';

export interface DefectLogScope {
  vesselId?: string;
  selectedVessel: string;
  selectedVesselName: string;
  selectedVesselNames: string[];
  search?: string;
  periodValue?: PeriodValue | null;
  dueOverdue?: string;
  // These affected legacy request/reset identity but were not applied as filters.
  type?: string;
  fleet?: string;
  addGroup?: string;
}
export interface DefectLogPage {
  items: Defect[]; total: number; page: number; pageSize: number; totalPages: number;
}

export async function fetchDefectLog(
  scope: DefectLogScope, page: number, exporting = false, signal?: AbortSignal,
): Promise<DefectLogPage> {
  const { vesselId, ...match } = scope;
  const browser = new Intl.DateTimeFormat().resolvedOptions();
  const params = new URLSearchParams({
    page: String(page),
    match: JSON.stringify({ ...match, timeZone: browser.timeZone, locale: browser.locale, now: new Date().toISOString() }),
  });
  if (vesselId) params.set('vesselId', vesselId);
  if (exporting) params.set('export', 'true');
  const response = await fetch(`/technical/api/defects/log-page?${params}`, { signal });
  if (!response.ok) throw new Error(exporting ? 'Failed to fetch complete Defect Log export' : 'Failed to fetch defects');
  const data = await response.json();
  if (!Array.isArray(data.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page)) {
    throw new Error('Invalid Defect Log response');
  }
  return data;
}

export function useDefectLogPage(scope: DefectLogScope) {
  const queryClient = useQueryClient();
  const scopeKey = JSON.stringify(scope);
  const [navigation, setNavigation] = useState({ scopeKey, page: 1 });
  // Derive the reset before requesting data, not in an effect reacting to every
  // new result array. A filter change must never issue a later-page request.
  const requestedPage = navigation.scopeKey === scopeKey ? navigation.page : 1;
  useEffect(() => {
    setNavigation(previous => previous.scopeKey === scopeKey ? previous : { scopeKey, page: 1 });
  }, [scopeKey]);
  const query = useQuery({
    queryKey: ['defects', 'log-page', scopeKey, requestedPage],
    queryFn: ({ signal }) => fetchDefectLog(scope, requestedPage, false, signal),
    placeholderData: keepPreviousData,
  });
  const currentPage = !query.isPlaceholderData && query.data ? query.data.page : requestedPage;
  useEffect(() => {
    if (!query.isPlaceholderData && query.data && query.data.page !== requestedPage) {
      // Reuse the clamped response instead of briefly showing an old cached
      // final page/count or issuing a duplicate read under the corrected key.
      queryClient.setQueryData(['defects', 'log-page', scopeKey, query.data.page], query.data);
      setNavigation({ scopeKey, page: query.data.page });
    }
  }, [query.data, query.isPlaceholderData, requestedPage, scopeKey, queryClient]);
  const setCurrentPage = (update: number | ((page: number) => number)) => {
    setNavigation({ scopeKey, page: typeof update === 'function' ? update(currentPage) : update });
  };
  return { ...query, currentPage, setCurrentPage };
}
