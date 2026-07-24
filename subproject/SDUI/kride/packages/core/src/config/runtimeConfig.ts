export type RuntimeConfig = {
  apiBase?: string;
  krideApiBase?: string;
  routeParams?: Record<string, string | string[] | undefined>;
};

/** Result of a postcode/address lookup, matching the register form's ref_data_ids. */
export type PostcodeResult = {
  zipCode: string;
  roadAddress: string;
};

/** Platform adapter supplied by Next.js or expo-router. */
export type NavigationAdapter = {
  push: (path: string) => void;
  openExternal?: (url: string) => void;
  /** Surfaces a user-facing message. Web passes `window.alert`, mobile `Alert.alert`. */
  notify?: (message: string) => void;
  /**
   * Opens the platform's address search UI (web: Daum postcode modal, mobile:
   * native search modal). Calls `onComplete` with the picked address; the
   * OPEN_POSTCODE action writes it into formData's zipCode/roadAddress.
   */
  openPostcode?: (onComplete: (result: PostcodeResult) => void) => void;
};

export function resolveRuntimeConfig(config: RuntimeConfig = {}): Required<Pick<RuntimeConfig, 'apiBase' | 'krideApiBase'>> & RuntimeConfig {
  return {
    apiBase: config.apiBase ?? '',
    krideApiBase: config.krideApiBase ?? config.apiBase ?? '',
    routeParams: config.routeParams ?? {},
  };
}
