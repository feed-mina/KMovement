/**
 * 공용 지수 백오프 계산.
 * 실패할 때마다 기다리는 시간을 두 배로 늘리되(base × 2^attempt) 상한(maxMs)을 넘지 않고,
 * 여러 화면이 같은 순간에 몰리지 않도록 ±jitter 비율만큼 무작위로 흔든다.
 */
export interface BackoffOptions {
    baseMs: number;
    maxMs: number;
    /** 0~1. 0.2면 계산값의 ±20% 안에서 흔든다. */
    jitter?: number;
    random?: () => number;
}

export function backoffDelay(attempt: number, { baseMs, maxMs, jitter = 0.2, random = Math.random }: BackoffOptions): number {
    const safeAttempt = Math.max(0, Math.floor(attempt));
    const raw = Math.min(maxMs, baseMs * 2 ** Math.min(safeAttempt, 20));
    const spread = raw * Math.min(Math.max(jitter, 0), 1);
    const value = raw - spread + random() * spread * 2;
    return Math.round(Math.min(maxMs, Math.max(0, value)));
}
