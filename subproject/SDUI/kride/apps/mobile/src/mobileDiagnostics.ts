export type MobileFailureSummary = {
  code: string;
  message: string;
};

/**
 * Converts runtime failures into support-friendly text without rendering raw
 * exception messages, stack traces, request paths, or credentials on device.
 */
export const summarizeMobileFailure = (error: unknown): MobileFailureSummary => {
  const raw = error instanceof Error ? error.message : String(error || '');
  const normalized = raw.toLowerCase();
  const httpStatus = raw.match(/(?:http\s*)?\b([45]\d{2})\b/i)?.[1];

  if (httpStatus === '401') return { code: 'KRIDE-MOBILE-AUTH', message: '로그인이 만료되었거나 필요합니다.' };
  if (httpStatus === '403') return { code: 'KRIDE-MOBILE-FORBIDDEN', message: '이 화면을 볼 권한이 없습니다.' };
  if (httpStatus === '404') return { code: 'KRIDE-MOBILE-SCREEN-404', message: '배포 환경에 화면 설정이 아직 없습니다.' };
  if (httpStatus?.startsWith('5')) return { code: 'KRIDE-MOBILE-SERVER', message: '서버가 요청을 처리하지 못했습니다.' };
  if (normalized.includes('abort') || normalized.includes('timeout')) {
    return { code: 'KRIDE-MOBILE-TIMEOUT', message: '응답 시간이 길어 연결을 종료했습니다.' };
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('connection')) {
    return { code: 'KRIDE-MOBILE-NETWORK', message: '네트워크 또는 서버 연결을 확인해 주세요.' };
  }
  return { code: 'KRIDE-MOBILE-UNKNOWN', message: '화면 데이터를 처리하지 못했습니다.' };
};

export const publicApiOrigin = (apiBase: string) => {
  if (!apiBase) return 'API 주소 미설정';
  try {
    return new URL(apiBase).origin;
  } catch {
    return 'API 주소 형식 오류';
  }
};
