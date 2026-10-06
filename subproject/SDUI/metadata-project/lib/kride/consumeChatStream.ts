/** Consume complete SSE frames, including CRLF and split UTF-8 network chunks. */
export async function consumeChatStream(
  response: Response,
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<void> {
  if (!response.ok) {
    throw new Error(response.status === 401 ? '로그인이 필요합니다.'
      : response.status === 403 ? '현재 테스트 계정에서만 이용할 수 있어요.'
      : response.status === 503 ? '답변 서비스를 준비 중입니다. 잠시 후 이용해 주세요.'
      : response.status === 429 ? 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
      : `답변 서버에 연결하지 못했습니다. (${response.status})`);
  }
  if (!response.body) throw new Error('답변 스트림이 없습니다.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const cancelled = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancelled, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const raw = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!raw) continue;
        if (raw === '[DONE]' || raw === '"[DONE]"') return;
        let data: { content?: unknown; error?: unknown };
        try { data = JSON.parse(raw); }
        catch { throw new Error('답변 형식이 올바르지 않습니다.'); }
        if (!data || typeof data !== 'object') throw new Error('답변 형식이 올바르지 않습니다.');
        if (data.error) throw new Error('답변 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
        if (typeof data.content === 'string') onChunk(data.content);
      }
      if (done) throw new Error('답변 연결이 중간에 끊겼습니다. 다시 시도해 주세요.');
    }
  } finally {
    signal.removeEventListener('abort', cancelled);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
