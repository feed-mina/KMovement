// A same-tab navigation hint only. No account data or authentication tokens.
const KEY = 'kride.login-return';
const MAX_AGE = 10 * 60 * 1000;
const FALLBACK = '/view/MY_PAGE';

export function safeLoginReturn(value: unknown): string {
    if (value === '/') return '/'; // 랜딩 홈 (벤치마킹 H3 배너) 은 /view/ 밖에 있는 유일한 복귀처
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

// 벤치마킹 H8: 로그인 화면이 "로그인하면 ○○으로 돌아가요" 라고 말할 때 쓰는 화면 이름. 모르는 화면은 null.
const RETURN_LABELS: Array<[RegExp, string]> = [
    [/^\/$/, '홈'],
    [/^\/view\/TOUR_EXPLORE$/, '여행지 탐색'],
    [/^\/view\/ROUTE_PLANNER$/, '코스 만들기'],
    [/^\/view\/(INTRO[1-5]|KRIDE_INTRO[1-5])$/, '아티스트 코스 만들기'],
    [/^\/view\/(FOCUS|KRIDE_FOCUS|MY_LIST|KRIDE_MY_LIST)$/, '내 코스'],
    [/^\/view\/(kpop|KPOP|KPOP_EXPLORE)$/, '아티스트'],
    [/^\/view\/KPOP_ARTIST_DETAIL/, '아티스트 상세'],
    [/^\/view\/KPOP_EVENTS$/, '팬 일정'],
    [/^\/view\/KPOP_EVENT_DETAIL/, '일정 상세'],
    [/^\/view\/KPOP_PRODUCTS/, '상품'],
    [/^\/view\/KPOP_SAVED_ITEMS$/, '내 목록'],
    [/^\/view\/KPOP_AI_(FIND|RESULT)$/, 'AI 코스'],
    [/^\/view\/MY_PAGE$/, '마이'],
    [/^\/view\/SET_TIME_PAGE$/, '약속 시간'],
    [/^\/view\/(CHAT|KRIDE_CHAT)$/, '여행봇'],
    [/^\/view\/AI_[A-Z]+_CHAT_PAGE$/, '언어 채팅'],
    [/^\/view\/COMMUNITY_/, '커뮤니티'],
    [/^\/view\/CONTENT_/, '가이드'],
];
export function loginReturnLabel(path: string): string | null {
    const pathname = path.split('?')[0];
    return RETURN_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}
