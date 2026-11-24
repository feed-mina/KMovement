/**
 * Turn any error payload (FastAPI `detail` string/object/list, Spring `error`/`message`) into
 * one readable sentence. Passing an object to `new Error()` renders "[object Object]".
 */
function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) return value.length ? '요청 조건을 확인해 주세요.' : undefined;
  if (value && typeof value === 'object') {
    const { message, msg, detail, error } = value as Record<string, unknown>;
    return textOf(message) ?? textOf(msg) ?? textOf(detail) ?? textOf(error);
  }
  return undefined;
}

export function problemMessage(payload: unknown, status?: number): string {
  const problem = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return textOf(problem.detail) ?? textOf(problem.error) ?? textOf(problem.message)
    ?? (status === 429 ? 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
      : status === 401 ? '로그인이 필요합니다.'
      : status === 403 ? '현재 테스트 계정에서만 이용할 수 있어요.'
      : status ? `답변 서버 오류 (${status})` : '알 수 없는 오류가 발생했습니다.');
}

/** Readable text for anything thrown, never "[object Object]". */
export function errorText(error: unknown): string {
  if (error instanceof Error && error.message && error.message !== '[object Object]') return error.message;
  return typeof error === 'string' && error ? error : problemMessage(error);
}
