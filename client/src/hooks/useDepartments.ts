import { useQuery } from "@tanstack/react-query";

interface MasterListItem {
  id: number;
  listType: string;
  listKey: string;
  listValue: string;
  displayOrder: number;
  isActive: boolean;
}

export function useDepartments() {
  return useQuery<MasterListItem[]>({
    queryKey: ['/api/fleet/master-lists', { listType: 'department' }],
    queryFn: async () => {
      const res = await fetch('/api/fleet/master-lists?listType=department');
      if (!res.ok) throw new Error('Failed to fetch departments');
      return res.json();
    }
  });
}

export function useDepartmentOptions() {
  const { data: departments = [], isLoading, error } = useDepartments();
  
  const options = departments
    .filter(d => d.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(d => ({
      value: d.listKey,
      label: d.listValue
    }));
  
  return { options, isLoading, error, departments };
}

export function useMasterList(listType: string) {
  return useQuery<MasterListItem[]>({
    queryKey: ['/api/fleet/master-lists', { listType }],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/master-lists?listType=${listType}`);
      if (!res.ok) throw new Error(`Failed to fetch ${listType} list`);
      return res.json();
    }
  });
}

export function useMasterListOptions(listType: string) {
  const { data: items = [], isLoading, error } = useMasterList(listType);
  
  const options = items
    .filter(d => d.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(d => ({
      value: d.listKey,
      label: d.listValue
    }));
  
  return { options, isLoading, error, items };
}
