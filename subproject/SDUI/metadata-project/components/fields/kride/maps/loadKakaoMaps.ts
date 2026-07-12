'use client';

const KAKAO_SDK_SCRIPT_ID = 'kakao-maps-sdk';
const KAKAO_SDK_LOAD_TIMEOUT_MS = 10000;

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

  if (!appKey) {
    return Promise.reject(new Error('Kakao Maps API key is missing. Check NEXT_PUBLIC_KAKAO_MAP_APP_KEY.'));
  }

  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao)));
  }

  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(KAKAO_SDK_SCRIPT_ID) as HTMLScriptElement | null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearLoadTimeout = () => {
      if (!timeoutId) return;
      clearTimeout(timeoutId);
      timeoutId = null;
    };

    const fail = (message: string) => {
      clearLoadTimeout();
      kakaoMapsPromise = null;
      reject(new Error(message));
    };

    const handleLoaded = () => {
      if (!window.kakao?.maps) {
        fail(
          'Kakao Maps SDK loaded but did not initialize. Check that the key is a Kakao JavaScript key and the current domain is registered in Kakao Developers.'
        );
        return;
      }

      window.kakao.maps.load(() => {
        clearLoadTimeout();
        resolve(window.kakao);
      });
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        handleLoaded();
        return;
      }

      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => {
        fail('Kakao Maps SDK failed to load. Check CSP, network access, and Kakao JavaScript key domain settings.');
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SDK_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;

    timeoutId = setTimeout(() => {
      script.remove();
      fail('Kakao Maps SDK load timed out. Check network access, CSP, and Kakao JavaScript key domain settings.');
    }, KAKAO_SDK_LOAD_TIMEOUT_MS);

    script.onload = () => {
      script.dataset.loaded = 'true';
      handleLoaded();
    };

    script.onerror = () => {
      script.remove();
      fail('Kakao Maps SDK failed to load. Check CSP, network access, and Kakao JavaScript key domain settings.');
    };

    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}
