import {
    registerScreen,
    resolveScreenController,
    __clearScreenRegistry,
} from "@/components/screens/registry";
import {
    registerScreenAccess,
    resolveScreenAccess,
    __clearScreenAccess,
} from "@/components/screens/screenAccess";
import {
    registerFormPersistence,
    getFormPersistence,
    __clearFormPersistence,
} from "@/components/screens/persistence";
import { componentMap, componentRegistry, registerComponent } from "@/components/constants/componentMap";
import { SCREEN_MAP, registerScreenPaths } from "@/components/constants/screenMap";

// 엔진 코어의 화면 플러그인 메커니즘 스모크 테스트.
// 도메인 컴포넌트 없이 순수 레지스트리만 검증 → "순수 엔진" 동작 보장.
const Dummy: any = () => null;

describe("screen controller registry (engine core)", () => {
    beforeEach(() => {
        __clearScreenRegistry();
        __clearScreenAccess();
        __clearFormPersistence();
    });

    it("등록된 매처로 컨트롤러를 해석한다", () => {
        registerScreen({ match: (id) => id === "FOO", controller: Dummy });
        expect(resolveScreenController("FOO")).toBe(Dummy);
    });

    it("미등록 화면은 null → 호출측이 기본 컨트롤러로 대체", () => {
        expect(resolveScreenController("UNKNOWN")).toBeNull();
    });

    it("먼저 등록된 매처가 우선한다", () => {
        const A: any = () => null;
        const B: any = () => null;
        registerScreen({ match: (id) => id.startsWith("X"), controller: A });
        registerScreen({ match: (id) => id === "X1", controller: B });
        expect(resolveScreenController("X1")).toBe(A);
    });
});

describe("screen access registry (engine core)", () => {
    beforeEach(() => __clearScreenAccess());

    it("매칭되는 규칙을 병합한다", () => {
        registerScreenAccess((id) => id === "S", { requireAuth: true });
        registerScreenAccess((id) => id === "S", { requireRole: "ROLE_ADMIN" });
        expect(resolveScreenAccess("S")).toEqual({ requireAuth: true, requireRole: "ROLE_ADMIN" });
    });

    it("규칙 없는 화면은 빈 객체", () => {
        expect(resolveScreenAccess("OPEN_PAGE")).toEqual({});
    });
});

describe("form persistence registry (engine core)", () => {
    beforeEach(() => __clearFormPersistence());

    it("영속화 대상 화면의 storageKey를 반환한다", () => {
        registerFormPersistence({ predicate: (id) => id.startsWith("KRIDE_"), storageKey: "kride_form" });
        expect(getFormPersistence("KRIDE_FOCUS")).toEqual({ storageKey: "kride_form" });
    });

    it("비대상 화면은 null(영속화 안 함)", () => {
        registerFormPersistence({ predicate: (id) => id.startsWith("KRIDE_"), storageKey: "kride_form" });
        expect(getFormPersistence("LOGIN_PAGE")).toBeNull();
    });
});

describe("runtime plugin registration (engine core)", () => {
    const PluginComponent: any = () => null;

    it("registerComponent가 componentRegistry와 componentMap을 함께 갱신한다", () => {
        registerComponent("TEST_PLUGIN_WIDGET", PluginComponent, { needsFormData: true });

        expect(componentRegistry.TEST_PLUGIN_WIDGET.needsFormData).toBe(true);
        expect(componentRegistry.TEST_PLUGIN_WIDGET.component).toBe(componentMap.TEST_PLUGIN_WIDGET);
        expect(componentMap.TEST_PLUGIN_WIDGET).toEqual(expect.any(Function));
    });

    it("registerScreenPaths가 SCREEN_MAP에 플러그인 경로를 병합한다", () => {
        registerScreenPaths({ "/TEST_PLUGIN": "TEST_PLUGIN_SCREEN" });

        expect(SCREEN_MAP["/TEST_PLUGIN"]).toBe("TEST_PLUGIN_SCREEN");
    });
});
