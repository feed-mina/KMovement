// 카카오 JS SDK(공유용) 로더 + 초기화. Epic #74 · 카카오 공유.
// 카카오 지도/로그인과 동일한 JavaScript 앱키(NEXT_PUBLIC_KAKAO_MAP_APP_KEY)를 재사용한다.
// CSP script-src에 *.kakaocdn.net 이 이미 허용되어 있다.

declare global {
    interface Window {
        Kakao?: any;
    }
}

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
const SDK_SCRIPT_ID = 'kakao-js-sdk';
const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? '';

let loadingPromise: Promise<any> | null = null;

function ensureInit(): any {
    const K = window.Kakao;
    if (K && typeof K.isInitialized === 'function' && !K.isInitialized()) {
        K.init(KEY);
    }
    return K;
}

export function loadKakaoShare(): Promise<any> {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (!KEY) return Promise.reject(new Error('NEXT_PUBLIC_KAKAO_MAP_APP_KEY 미설정'));

    if (window.Kakao?.Share) return Promise.resolve(ensureInit());
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
        const onReady = () => {
            try { resolve(ensureInit()); } catch (e) { reject(e); }
        };
        if (existing) {
            if (window.Kakao?.Share) onReady();
            else existing.addEventListener('load', onReady, { once: true });
            return;
        }
        const script = document.createElement('script');
        script.id = SDK_SCRIPT_ID;
        script.src = SDK_URL;
        script.async = true;
        script.onload = onReady;
        script.onerror = () => reject(new Error('카카오 SDK 로드 실패'));
        document.head.appendChild(script);
    });
    return loadingPromise;
}
