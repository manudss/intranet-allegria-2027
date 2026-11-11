export interface RuntimeConfig {
  apiBaseUrl: string;
}

declare global {
  interface Window {
    __ALLEGRIA_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: '',
};

const normalizeApiBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) return trimmed.slice(0, -4);
  return trimmed;
};

const setRuntimeConfig = (config: RuntimeConfig): void => {
  window.__ALLEGRIA_RUNTIME_CONFIG__ = config;
};

const currentRuntimeConfig = (): RuntimeConfig =>
  window.__ALLEGRIA_RUNTIME_CONFIG__ ?? DEFAULT_RUNTIME_CONFIG;

export const loadRuntimeConfig = async (): Promise<void> => {
  try {
    const response = await fetch('/app-config.json', { cache: 'no-store' });

    if (!response.ok) {
      console.error(`Runtime config request failed with status ${response.status}.`);
      setRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
      return;
    }

    const payload = (await response.json()) as Partial<RuntimeConfig>;
    setRuntimeConfig({
      apiBaseUrl: normalizeApiBaseUrl(payload.apiBaseUrl),
    });
  } catch (error) {
    console.error('Failed to load runtime config.', error);
    setRuntimeConfig(DEFAULT_RUNTIME_CONFIG);
  }
};

export const apiUrl = (path: string): string => {
  const { apiBaseUrl } = currentRuntimeConfig();
  return path.startsWith('/api') && apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};

export const isApiRequest = (url: string): boolean => {
  const { apiBaseUrl } = currentRuntimeConfig();
  return url.startsWith('/api') || (apiBaseUrl.length > 0 && url.startsWith(`${apiBaseUrl}/api`));
};
