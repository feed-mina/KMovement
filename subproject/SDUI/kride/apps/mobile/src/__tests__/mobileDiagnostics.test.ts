import { publicApiOrigin, summarizeMobileFailure } from '../mobileDiagnostics';

describe('mobile diagnostics', () => {
  it('classifies common release failures without exposing a raw request URL', () => {
    const failure = summarizeMobileFailure(new Error('GET https://api.example.com/private/screen?token=secret HTTP 404'));

    expect(failure).toEqual({
      code: 'KRIDE-MOBILE-SCREEN-404',
      message: '배포 환경에 화면 설정이 아직 없습니다.',
    });
    expect(JSON.stringify(failure)).not.toContain('token');
    expect(JSON.stringify(failure)).not.toContain('/private/');
  });

  it('shows only the public API origin in device diagnostics', () => {
    expect(publicApiOrigin('https://api.example.com/private/path?key=secret')).toBe('https://api.example.com');
    expect(publicApiOrigin('')).toBe('API 주소 미설정');
  });
});
