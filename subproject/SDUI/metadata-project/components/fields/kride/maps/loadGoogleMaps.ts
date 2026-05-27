'use client';

let googleMapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-sdk') as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (!window.google?.maps) {
        reject(new Error('Google Maps SDK failed to initialize.'));
        return;
      }
      resolve(window.google);
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps SDK failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = handleLoaded;
    script.onerror = () => reject(new Error('Google Maps SDK failed to load.'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
