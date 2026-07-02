import { ReactNode } from "react";

interface OnboardingPageShellProps {
  /** 페이지 본문 (DynamicEngine 또는 로딩 상태 포함) */
  children: ReactNode;
  /**
   * 하단 고정 바 콘텐츠 (선택 정보 + 다음 버튼 등).
   * 전달하지 않으면 고정 하단 바 없이 렌더링된다.
   */
  bottomBar?: ReactNode;
}

/**
 * 온보딩 페이지 공통 쉘.
 * /browse ~ /intro5 에서 반복되는 검은 배경 + flex-col 래퍼,
 * 하단 고정 바 구조를 통합한다.
 *
 * 하단 바 확장 규칙:
 *  - 선택 수 표시가 있는 경우: `<OnboardingPageShell bottomBar={<> ... </>}>`
 *  - 단순 전체 너비 버튼만 있는 경우도 동일하게 bottomBar prop에 전달
 *  - 하단 바가 없는 화면(browse 폴백 등)은 bottomBar를 생략한다
 */
export default function OnboardingPageShell({
  children,
  bottomBar,
}: OnboardingPageShellProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1">{children}</div>
      {bottomBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-6 py-4 z-50">
          {bottomBar}
        </div>
      )}
    </div>
  );
}
