import { useQuery } from "@tanstack/react-query";

interface UseExternalDataOptions {
  enabled?: boolean;
}

function buildProxyUrl(endpoint: string, domain: string): string {
  return `/technical/api/external/master-data/${endpoint}?domain=${encodeURIComponent(domain)}`;
}

export function getDomain(): string {
  try {
    const domain = localStorage.getItem('domain');
    if (domain && domain.trim().length > 0) {
      return domain.trim();
    }
    console.warn('[getDomain] "domain" key not found or empty in localStorage. Falling back to "rsms".');
    return 'rsms';
  } catch (e) {
    console.warn('[getDomain] Failed to read "domain" from localStorage:', e, '. Falling back to "rsms".');
    return 'rsms';
  }
}

export const useLocalVessels = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/vessels'],
    queryFn: async () => {
      const response = await fetch('/technical/api/vessels', {
        method: 'GET',
        headers: { 'accept': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch vessels: ${response.status}`);
      const data = await response.json();
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalNationalities = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/nationalities'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('nationalities', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch nationalities: ${response.status}`);
      const data = await response.json();
      return data.nationalities || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalVessels = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/vessels'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('vessels', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch vessels: ${response.status}`);
      const data = await response.json();
      return data.vessels || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalVesselTypes = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/vesselTypes'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('vesseltypes', getDomain()),
        { method: 'GET', headers: { accept: '*/*' }, credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch vessel types: ${response.status}`);
      }

      const data = await response.json();

      return (data.vesseltypes || []).map((item: any) => {
        const classifications: string[] = [];

        if (item.tanker === 1) classifications.push('Tanker');
        if (item.oilTanker === 1) classifications.push('Oil');
        if (item.gasTanker === 1) classifications.push('Gas');
        if (item.chemicalTanker === 1) classifications.push('Chemical');
        if (item.dry === 1) classifications.push('Dry');
        if (item.container === 1) classifications.push('Container');

        return {
          ...item,
          classification:
            classifications.length > 0 ? classifications.join(', ') : null,
        };
      });
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};


export const useExternalLicenses = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/licenses'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('licenses', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch licenses: ${response.status}`);
      const data = await response.json();
      return data.licenses || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalAdditionalGroups = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/additionalGroups'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('additionalgroups', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch additional groups: ${response.status}`);
      const data = await response.json();
      return data.additionalGroups || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalPorts = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/ports'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('ports', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch ports: ${response.status}`);
      const data = await response.json();
      return data.ports || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalLanguages = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/languages'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('languages', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch languages: ${response.status}`);
      const data = await response.json();
      return data.languages || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalFleetGroups = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/fleetGroups'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('fleetgroups', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch fleet groups: ${response.status}`);
      const data = await response.json();
      return data.fleetGroups || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalCountries = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/countries'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('countries', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch countries: ${response.status}`);
      const data = await response.json();
      return data.countries || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalManningAgents = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/manningAgents'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('manningagents', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch manning agents: ${response.status}`);
      const data = await response.json();
      return data.manningAgents || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalCrewPools = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/crewPools'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('crewpools', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch crew pools: ${response.status}`);
      const data = await response.json();
      return data.crewPools || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalAppraisalTypes = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/appraisalTypes'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('appraisaltypes', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch appraisal types: ${response.status}`);
      const data = await response.json();
      return data.appraisalTypes || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalUsers = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/users'],
    queryFn: async () => {
      const response = await fetch(
        buildProxyUrl('users', getDomain()),
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);
      const data = await response.json();
      return data.users || [];
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useLocalApprovers = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/admin/local-approvers'],
    queryFn: async () => {
      const response = await fetch('/technical/api/admin/local-approvers', {
        method: 'GET',
        headers: { 'accept': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to fetch local approvers: ${response.status}`);
      const data = await response.json();
      return (data || []).map((a: any) => ({ ...a, isActiveLabel: a.isActive === 1 ? 'Active' : 'Inactive' }));
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};

export const useExternalApprovers = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/admin/approvers'],
    queryFn: async () => {
      const domain = getDomain();
      const response = await fetch(
        `/technical/api/admin/approvers?domain=${encodeURIComponent(domain)}`,
        { method: 'GET', headers: { 'accept': '*/*' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`Failed to fetch approvers: ${response.status}`);
      const data = await response.json();
      const all: any[] = data.mocapprovers || [];
      return all
        .filter((a) => a.modulename === 'Technical')
        .map((a) => ({ ...a, isActiveLabel: a.isActive === 1 ? 'Active' : 'Inactive' }));
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
    enabled: options?.enabled ?? true,
  });
};
