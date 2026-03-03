const DEFAULT_DEV_URL = 'https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata';

function getExternalMasterDataBaseUrl(): string {
  const envUrl = process.env.EXTERNAL_MASTER_DATA_URL;

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[ExternalAPI] WARNING: EXTERNAL_MASTER_DATA_URL is not set in production. Falling back to dev URL.'
    );
  }

  return DEFAULT_DEV_URL;
}

export const EXTERNAL_MASTER_DATA_BASE_URL = getExternalMasterDataBaseUrl();

export function buildExternalMasterDataUrl(endpoint: string, domain: string): string {
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${EXTERNAL_MASTER_DATA_BASE_URL}/${cleanEndpoint}?domain=${encodeURIComponent(domain)}`;
}
