// A same-tab navigation hint only. No account data or authentication tokens.
const KEY = 'kride.login-return';
const MAX_AGE = 10 * 60 * 1000;
const FALLBACK = '/view/MY_PAGE';

export function safeLoginReturn(value: unknown): string {
    if (typeof value !== 'string' || value.length > 1024 || /[\\\u0000-\u0020]/.test(value)) return FALLBACK;
    try {
        const url = new URL(value, 'https://kride.invalid');
        if (!value.startsWith('/view/') || url.origin !== 'https://kride.invalid' ||
            !/^\/view\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
            ['LOGIN_PAGE', 'ADDITIONAL_INFO_PAGE'].includes(url.pathname.split('/').pop()!)) return FALLBACK;
        return url.pathname + url.search;
    } catch { return FALLBACK; }
}

export function clearLoginReturn(): void {
    try { sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
}

export function rememberLoginReturn(path: string): void {
    clearLoginReturn();
    try { sessionStorage.setItem(KEY, JSON.stringify({path: safeLoginReturn(path), at: Date.now()})); } catch { /* Login still works without the hint. */ }
}

export function consumeLoginReturn(): string | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        clearLoginReturn();
        if (!raw) return null;
        const value = JSON.parse(raw);
        const age = Date.now() - value.at;
        if (!Number.isFinite(value.at) || age < 0 || age > MAX_AGE) return null;
        return safeLoginReturn(value.path);
    } catch { clearLoginReturn(); return null; }
}
