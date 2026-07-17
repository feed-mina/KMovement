export type RuntimeConfig = {
  apiBase?: string;
  krideApiBase?: string;
  routeParams?: Record<string, string | string[] | undefined>;
};

/** Platform adapter supplied by Next.js or expo-router. */
export type NavigationAdapter = {
  push: (path: string) => void;
  openExternal?: (url: string) => void;
  /** Surfaces a user-facing message. Web passes `window.alert`, mobile `Alert.alert`. */
  notify?: (message: string) => void;
};

export function resolveRuntimeConfig(config: RuntimeConfig = {}): Required<Pick<RuntimeConfig, 'apiBase' | 'krideApiBase'>> & RuntimeConfig {
  return {
    apiBase: config.apiBase ?? '',
    krideApiBase: config.krideApiBase ?? config.apiBase ?? '',
    routeParams: config.routeParams ?? {},
  };
}
