import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { usePageHook } from "@kride/core";

// 배포 웹 /kpop 크래시(React #301, Too many re-renders) 회귀 테스트.
// 호출부가 매 렌더마다 metadata `[]` 기본값·routeParams 리터럴·네비게이션
// 어댑터를 새 참조로 넘겨도 코어 훅의 렌더 중 상태 보정이 수렴해야 한다.
function ChurnHarness({ email }: { email?: string }) {
  const [, setTick] = useState(0);
  const page = usePageHook(
    "TEST_SCREEN",
    [],
    {},
    { push: () => {}, openExternal: () => {} },
    { email, code: email ? "1234" : undefined }
  );
  return (
    <div>
      <button onClick={() => setTick((n) => n + 1)}>rerender</button>
      <input
        aria-label="userId"
        value={page.formData.userId ?? ""}
        onChange={(e) => page.handleChange("userId", e.target.value)}
      />
      <span data-testid="email">{page.formData.email ?? ""}</span>
    </div>
  );
}

describe("usePageHook render stability", () => {
  it("does not loop when every prop is a fresh reference each render", () => {
    render(<ChurnHarness />);
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByText("rerender"));
    }
    expect(screen.getByLabelText("userId")).toBeInTheDocument();
  });

  it("keeps typed form values across re-renders with churned props", () => {
    render(<ChurnHarness />);
    fireEvent.change(screen.getByLabelText("userId"), {
      target: { value: "mina" },
    });
    fireEvent.click(screen.getByText("rerender"));
    expect((screen.getByLabelText("userId") as HTMLInputElement).value).toBe(
      "mina"
    );
  });

  it("still resets the form when the email route param actually changes", () => {
    const { rerender } = render(<ChurnHarness />);
    fireEvent.change(screen.getByLabelText("userId"), {
      target: { value: "mina" },
    });
    rerender(<ChurnHarness email="fan@kride.app" />);
    expect(screen.getByTestId("email").textContent).toBe("fan@kride.app");
    expect((screen.getByLabelText("userId") as HTMLInputElement).value).toBe(
      ""
    );
  });
});
