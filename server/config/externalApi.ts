type AppEnv = 'local' | 'dev' | 'production';

const VALID_APP_ENVS: AppEnv[] = ['local', 'dev', 'production'];

function resolveAppEnv(): AppEnv {
  const appEnv = process.env.APP_ENV;

  if (appEnv) {
    if (!VALID_APP_ENVS.includes(appEnv as AppEnv)) {
      throw new Error(
        `[Environment] FATAL: Invalid APP_ENV="${appEnv}". Must be one of: ${VALID_APP_ENVS.join(', ')}`
      );
    }
    return appEnv as AppEnv;
  }

  const nodeEnv = process.env.NODE_ENV;
  let inferred: AppEnv;

  if (nodeEnv === 'production') {
    inferred = 'production';
  } else {
    inferred = 'local';
  }

  console.warn(
    `[Environment] WARNING: APP_ENV is not set. Inferred "${inferred}" from NODE_ENV="${nodeEnv || 'undefined'}". Set APP_ENV explicitly for reliable environment detection.`
  );

  return inferred;
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url.substring(0, 30) + '...';
  }
}

export const APP_ENV = resolveAppEnv();

let _cachedBaseUrl: string | null = null;

export function getExternalMasterDataBaseUrl(): string {
  if (_cachedBaseUrl !== null) return _cachedBaseUrl;

  const devUrl = process.env.EXTERNAL_MASTER_DATA_URL_DEV;
  const prodUrl = process.env.EXTERNAL_MASTER_DATA_URL_PROD;

  let selectedUrl: string | undefined;

  if (APP_ENV === 'local' || APP_ENV === 'dev') {
    if (!devUrl) {
      throw new Error(
        `[ExternalAPI] EXTERNAL_MASTER_DATA_URL_DEV is not set. Required when APP_ENV="${APP_ENV}". Set this environment variable before using the sync endpoint.`
      );
    }
    selectedUrl = devUrl;
  } else {
    if (!prodUrl) {
      throw new Error(
        `[ExternalAPI] EXTERNAL_MASTER_DATA_URL_PROD is not set. Required when APP_ENV="production". Set this environment variable before using the sync endpoint.`
      );
    }
    selectedUrl = prodUrl;
  }

  _cachedBaseUrl = selectedUrl.replace(/\/+$/, '');

  console.log(`[Environment] APP_ENV=${APP_ENV}`);
  console.log(`[ExternalAPI] Using ${APP_ENV === 'production' ? 'PRODUCTION' : 'DEV'} master data URL (${maskUrl(_cachedBaseUrl)})`);

  return _cachedBaseUrl;
}

export function buildExternalMasterDataUrl(endpoint: string, domain: string): string {
  const baseUrl = getExternalMasterDataBaseUrl();
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${baseUrl}/${cleanEndpoint}?domain=${encodeURIComponent(domain)}`;
}

let _cachedCrewMasterUrl: string | null = null;

export function getCrewMasterDataBaseUrl(): string {
  if (_cachedCrewMasterUrl !== null) return _cachedCrewMasterUrl;

  const devUrl = process.env.EXTERNAL_CREW_MASTER_DATA_URL_DEV;
  const prodUrl = process.env.EXTERNAL_CREW_MASTER_DATA_URL_PROD;

  let selectedUrl: string | undefined;

  if (APP_ENV === 'local' || APP_ENV === 'dev') {
    if (!devUrl) {
      throw new Error(
        `[ExternalAPI] EXTERNAL_CREW_MASTER_DATA_URL_DEV is not set. Required when APP_ENV="${APP_ENV}". Set this environment variable to the direct crew master data base URL.`
      );
    }
    selectedUrl = devUrl;
  } else {
    if (!prodUrl) {
      throw new Error(
        `[ExternalAPI] EXTERNAL_CREW_MASTER_DATA_URL_PROD is not set. Required when APP_ENV="production". Set this environment variable to the direct crew master data base URL.`
      );
    }
    selectedUrl = prodUrl;
  }

  _cachedCrewMasterUrl = selectedUrl.replace(/\/+$/, '');

  console.log(`[ExternalAPI] Using ${APP_ENV === 'production' ? 'PRODUCTION' : 'DEV'} crew master data URL (${maskUrl(_cachedCrewMasterUrl)})`);

  return _cachedCrewMasterUrl;
}
