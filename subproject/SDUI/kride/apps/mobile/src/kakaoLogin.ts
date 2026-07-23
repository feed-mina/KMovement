// String-based on purpose: Hermes' built-in URL/URLSearchParams are incomplete
// on RN 0.74, so parsing with `new URL()` can throw at runtime.
const KAKAO_AUTHORIZE_PREFIX = 'https://kauth.kakao.com/oauth/authorize';

/**
 * The LOGIN_PAGE metadata carries one shared Kakao authorize URL for web and
 * mobile. The server's callback keys on `state`: no state → web cookie redirect,
 * `state=app` → 302 to the kride:// deep link that returns the user to this app.
 * Tag the URL right before opening it so the DB row stays platform-neutral.
 */
export const withKakaoAppState = (url: string): string => {
  if (!url.startsWith(KAKAO_AUTHORIZE_PREFIX)) return url;
  if (/[?&]state=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}state=app`;
};
