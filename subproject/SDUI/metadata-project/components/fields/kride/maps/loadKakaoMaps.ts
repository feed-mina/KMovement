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

  if (!appKey) {
    return Promise.reject(new Error('Kakao Maps API 키가 설정되지 않았습니다. NEXT_PUBLIC_KAKAO_MAP_APP_KEY를 확인해주세요.'));
  }

  // 이미 로드 완료된 경우
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(() => resolve(window.kakao)));
  }

  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('kakao-maps-sdk') as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (!window.kakao?.maps) {
        kakaoMapsPromise = null; // 재시도 가능하게 초기화
        reject(new Error('Kakao Maps SDK failed to initialize.'));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };

    if (existingScript) {
      // 스크립트가 이미 로드 완료된 경우 바로 처리
      if (existingScript.dataset.loaded === 'true') {
        handleLoaded();
        return;
      }
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => {
        kakaoMapsPromise = null;
        reject(new Error('Kakao Maps SDK failed to load.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = () => {
      script.dataset.loaded = 'true';
      handleLoaded();
    };
    script.onerror = () => {
      kakaoMapsPromise = null;
      reject(new Error('Kakao Maps SDK failed to load.'));
    };
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}
