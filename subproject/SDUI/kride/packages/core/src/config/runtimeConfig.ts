export type RuntimeConfig = {
  apiBase?: string;
  krideApiBase?: string;
  routeParams?: Record<string, string | string[] | undefined>;
};

export function resolveRuntimeConfig(config: RuntimeConfig = {}): Required<Pick<RuntimeConfig, 'apiBase' | 'krideApiBase'>> & RuntimeConfig {
  return {
    apiBase: config.apiBase ?? '',
    krideApiBase: config.krideApiBase ?? config.apiBase ?? '',
    routeParams: config.routeParams ?? {},
  };
}
