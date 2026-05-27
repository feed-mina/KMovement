'use client';

let kakaoMapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    kakao?: any;
  }
}

export function loadKakaoMaps(appKey: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps can only load in the browser.'));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao)));
  }

  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('kakao-maps-sdk') as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao Maps SDK failed to initialize.'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Kakao Maps SDK failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = handleLoaded;
    script.onerror = () => reject(new Error('Kakao Maps SDK failed to load.'));
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}
