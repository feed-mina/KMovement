'use client';

let googleMapsPromise: Promise<any> | null = null;
const GOOGLE_MAPS_AUTH_ERROR = 'Google Maps API rejected this key or project.';

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    __krideGoogleMapsAuthFailed?: boolean;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }

  if (window.__krideGoogleMapsAuthFailed) {
    return Promise.reject(new Error(GOOGLE_MAPS_AUTH_ERROR));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-sdk') as HTMLScriptElement | null;
    const previousAuthFailure = window.gm_authFailure;
    let settled = false;
    let resolveTimer: number | null = null;

    const cleanup = () => {
      if (resolveTimer) {
        window.clearTimeout(resolveTimer);
        resolveTimer = null;
      }
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      googleMapsPromise = null;
      cleanup();
      reject(error);
    };

    const resolveOnce = (google: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(google);
    };

    const handleAuthFailure = () => {
      window.__krideGoogleMapsAuthFailed = true;
      previousAuthFailure?.();
      rejectOnce(new Error(GOOGLE_MAPS_AUTH_ERROR));
    };

    const handleLoaded = () => {
      resolveTimer = window.setTimeout(() => {
        if (window.__krideGoogleMapsAuthFailed) {
          rejectOnce(new Error(GOOGLE_MAPS_AUTH_ERROR));
          return;
        }
        if (!window.google?.maps) {
          rejectOnce(new Error('Google Maps SDK failed to initialize.'));
          return;
        }
        resolveOnce(window.google);
      }, 1000);
    };

    window.gm_authFailure = handleAuthFailure;

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => rejectOnce(new Error('Google Maps SDK failed to load.')), { once: true });
      if (existingScript.dataset.krideLoaded === 'true' || window.google?.maps || window.__krideGoogleMapsAuthFailed) {
        handleLoaded();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.onload = () => {
      script.dataset.krideLoaded = 'true';
      handleLoaded();
    };
    script.onerror = () => rejectOnce(new Error('Google Maps SDK failed to load.'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
