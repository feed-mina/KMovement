import { withKakaoAppState } from '../kakaoLogin';

const AUTHORIZE_URL =
  'https://kauth.kakao.com/oauth/authorize?client_id=abc&redirect_uri=https://yerin.duckdns.org/api/kakao/callback&response_type=code';

describe('withKakaoAppState', () => {
  it('tags the seeded Kakao authorize URL with state=app', () => {
    expect(withKakaoAppState(AUTHORIZE_URL)).toBe(`${AUTHORIZE_URL}&state=app`);
  });

  it('uses ? when the authorize URL has no query yet', () => {
    expect(withKakaoAppState('https://kauth.kakao.com/oauth/authorize')).toBe(
      'https://kauth.kakao.com/oauth/authorize?state=app',
    );
  });

  it('leaves an existing state untouched', () => {
    const url = `${AUTHORIZE_URL}&state=web`;
    expect(withKakaoAppState(url)).toBe(url);
  });

  it('leaves non-Kakao external links untouched', () => {
    const url = 'https://example.com/page?state=missing';
    expect(withKakaoAppState(url)).toBe(url);
  });
});
