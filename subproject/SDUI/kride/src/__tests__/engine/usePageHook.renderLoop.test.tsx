/**
 * 배포된 /kpop 이 React #301 (Too many re-renders) 로 죽은 회귀에 대한 테스트다.
 *
 * 원인은 `usePageHook` 이 `routeParams` 를 매 렌더 새 객체 리터럴로 만들어
 * `useBaseActions` 의 렌더 중 참조 비교가 항상 "변경됨"이 되고, 그 자리에서
 * setState 를 호출해 렌더 루프가 끝나지 않은 것이었다.
 *
 * 기존 통합 테스트(`integration/kpop-page.test.tsx`)는 `usePageHook` 을 통째로
 * mock 해서 이 경로를 전혀 실행하지 않았고, 그래서 CI 가 계속 green 이었다.
 * 이 테스트는 실제 훅을 그대로 실행한다.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useBaseActions } from "@kride/core";

// 렌더 횟수를 세어 무한 루프를 잡는다. React 는 50회 근처에서 #301 을 던지므로
// 루프가 살아 있으면 render() 자체가 throw 한다.
function Probe({ metadata }: { metadata: any[] }) {
  const renders = React.useRef(0);
  renders.current += 1;
  const { formData } = usePageHook("KPOP_EXPLORE", metadata, {});
  return (
    <div>
      <span data-testid="renders">{renders.current}</span>
      <span data-testid="form-keys">{Object.keys(formData).length}</span>
    </div>
  );
}

describe("usePageHook 렌더 안정성", () => {
  it("서버가 빈 metadata 를 주어도 렌더 루프에 빠지지 않는다", () => {
    // 배포 환경 재현: /api/ui/KPOP_EXPLORE 가 빈 배열을 반환한 상태
    expect(() => render(<Probe metadata={[]} />)).not.toThrow();
    expect(Number(screen.getByTestId("renders").textContent)).toBeLessThan(5);
  });

  it("호출부가 매 렌더 새 배열을 만들어도 렌더 루프에 빠지지 않는다", () => {
    // `const { data: metadata = [] } = useUiScreen(...)` 로딩 중 패턴 재현
    function UnstableCaller() {
      return <Probe metadata={[]} />;
    }
    expect(() => render(<UnstableCaller />)).not.toThrow();
  });

  it("metadata 가 실제로 도착하면 한 번만 반영한다", () => {
    const { rerender } = render(<Probe metadata={[]} />);
    const meta = [{ componentId: "ARTIST_CARD", componentType: "ARTIST_CARD" }];
    expect(() => rerender(<Probe metadata={meta} />)).not.toThrow();
    expect(Number(screen.getByTestId("renders").textContent)).toBeLessThan(10);
  });
});

describe("useBaseActions routeParams 비교", () => {
  it("routeParams 가 매 렌더 새 객체여도 값이 같으면 재설정하지 않는다", () => {
    let renders = 0;
    function Inline() {
      renders += 1;
      // 수정 전 usePageHook 이 하던 그대로: 인라인 새 객체
      const { formData, handleChange } = useBaseActions(
        "KPOP_EXPLORE",
        [],
        {},
        { email: undefined, code: undefined }
      );
      return (
        <button onClick={() => handleChange("q", "bts")}>
          {String((formData as any).q ?? "")}
        </button>
      );
    }

    expect(() => render(<Inline />)).not.toThrow();
    expect(renders).toBeLessThan(5);
  });

  it("routeParams 값이 바뀌면 formData 를 재설정한다", () => {
    function Inline({ email }: { email?: string }) {
      const { formData } = useBaseActions("LOGIN_PAGE", [], {}, { email, code: "123" });
      return <span data-testid="email">{String((formData as any).email ?? "")}</span>;
    }

    const { rerender } = render(<Inline />);
    expect(screen.getByTestId("email").textContent).toBe("");

    rerender(<Inline email="a@b.com" />);
    expect(screen.getByTestId("email").textContent).toBe("a@b.com");
  });
});
