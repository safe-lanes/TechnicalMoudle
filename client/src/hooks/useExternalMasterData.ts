import { useQuery } from "@tanstack/react-query";

const BASE_URL = "https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata";

interface UseExternalDataOptions {
  enabled?: boolean;
}

export const useExternalNationalities = (options?: UseExternalDataOptions) => {
  return useQuery({
    queryKey: ['/technical/api/external/nationalities'],
    queryFn: async () => {
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/nationalities?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/vessels?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';

      const response = await fetch(
        `${BASE_URL}/vesseltypes?domain=${domain}`,
        { method: 'GET', headers: { accept: '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/licenses?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/additionalgroups?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/ports?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/languages?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/fleetgroups?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/countries?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/manningagents?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/crewpools?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/appraisaltypes?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
      const domain = localStorage.getItem('domain') || 'rsms';
      const response = await fetch(
        `${BASE_URL}/users?domain=${domain}`,
        { method: 'GET', headers: { 'accept': '*/*' } }
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
