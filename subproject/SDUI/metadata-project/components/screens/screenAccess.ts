// 화면 접근제어 규칙 레지스트리.
// 코어의 하드코딩된 PROTECTED_SCREENS/ADMIN_ONLY_SCREENS 배열을 대체한다.
// 코어는 자신의 화면을, 플러그인은 자신의 화면을 각각 등록한다.
export interface ScreenAccessRule {
    requireAuth?: boolean;
    requireRole?: string; // 예: 'ROLE_ADMIN'
    loginAlert?: boolean; // 로그인 리다이렉트 전 alert 표시 여부
}

interface AccessMatcher {
    match: (screenId: string) => boolean;
    rule: ScreenAccessRule;
}

const matchers: AccessMatcher[] = [];

export function registerScreenAccess(
    match: (screenId: string) => boolean,
    rule: ScreenAccessRule
): void {
    matchers.push({ match, rule });
}

// 매칭되는 모든 규칙을 병합해서 반환.
export function resolveScreenAccess(screenId: string): ScreenAccessRule {
    return matchers
        .filter((m) => m.match(screenId))
        .reduce<ScreenAccessRule>((acc, m) => ({ ...acc, ...m.rule }), {});
}

// 테스트용
export function __clearScreenAccess(): void {
    matchers.length = 0;
}
