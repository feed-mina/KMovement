import { backoffDelay } from '@/lib/net/backoff';

describe('backoffDelay', () => {
    const fixed = () => 0.5; // 흔들림 없이 가운데 값

    it('doubles the wait for each failure', () => {
        expect(backoffDelay(0, { baseMs: 3000, maxMs: 30000, random: fixed })).toBe(3000);
        expect(backoffDelay(1, { baseMs: 3000, maxMs: 30000, random: fixed })).toBe(6000);
        expect(backoffDelay(2, { baseMs: 3000, maxMs: 30000, random: fixed })).toBe(12000);
    });

    it('never exceeds the cap', () => {
        expect(backoffDelay(10, { baseMs: 3000, maxMs: 30000, random: () => 1 })).toBe(30000);
        expect(backoffDelay(99, { baseMs: 3000, maxMs: 30000, random: fixed })).toBe(30000);
    });

    it('spreads the wait within the jitter range', () => {
        expect(backoffDelay(0, { baseMs: 1000, maxMs: 10000, jitter: 0.2, random: () => 0 })).toBe(800);
        expect(backoffDelay(0, { baseMs: 1000, maxMs: 10000, jitter: 0.2, random: () => 1 })).toBe(1200);
    });
});
