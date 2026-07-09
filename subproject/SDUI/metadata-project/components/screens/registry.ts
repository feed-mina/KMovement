import type { ScreenController } from "./types";

// 화면 컨트롤러 레지스트리.
// screenId 문자열을 코어 라우터에서 분기하지 않고, 여기 등록된 매처로 위임한다.
// 도메인 플러그인(예: 여행)은 registerScreen으로 자신의 컨트롤러를 주입한다.
export interface ScreenRegistration {
    match: (screenId: string) => boolean;
    controller: ScreenController;
}

const registry: ScreenRegistration[] = [];

export function registerScreen(reg: ScreenRegistration): void {
    registry.push(reg);
}

// 먼저 등록된 매처가 우선. 없으면 null → 호출측이 기본 컨트롤러로 대체한다.
export function resolveScreenController(screenId: string): ScreenController | null {
    const hit = registry.find((r) => r.match(screenId));
    return hit ? hit.controller : null;
}

// 테스트용
export function __clearScreenRegistry(): void {
    registry.length = 0;
}
