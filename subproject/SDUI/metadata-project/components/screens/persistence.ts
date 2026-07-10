// 폼 데이터 영속화(localStorage) 설정 레지스트리.
// 코어 useBaseActions의 하드코딩된 isKrideScreen/kride_form 을 대체한다.
// 멀티스텝 온보딩처럼 화면 이동 간 formData를 보존해야 하는 화면이 등록한다.
export interface FormPersistenceConfig {
    predicate: (screenId: string) => boolean;
    storageKey: string;
}

const configs: FormPersistenceConfig[] = [];

export function registerFormPersistence(cfg: FormPersistenceConfig): void {
    configs.push(cfg);
}

// 해당 화면의 영속화 설정을 반환. 없으면 null(영속화 안 함).
export function getFormPersistence(screenId: string): { storageKey: string } | null {
    const hit = configs.find((c) => c.predicate(screenId));
    return hit ? { storageKey: hit.storageKey } : null;
}

// 테스트용
export function __clearFormPersistence(): void {
    configs.length = 0;
}
