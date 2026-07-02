'use client';
import { usePathname } from "next/navigation";

/**
 * (afterLogin) 레이아웃의 공통 헤더 컴포넌트.
 *
 * 헤더 숨김 규칙:
 *  - HIDE_PATHS 에 포함된 경로는 헤더를 렌더링하지 않는다.
 *  - 온보딩 플로우(/browse, /movies, /latest, /intro4, /intro5)와
 *    전체 화면 콘텐츠 페이지(/focus)는 기본으로 숨긴다.
 *
 * 확장 규칙:
 *  - 새 페이지에서 헤더를 숨기려면 HIDE_PATHS 배열에 경로 문자열을 추가한다.
 *  - 헤더에 메뉴/아이콘을 추가해야 한다면 이 파일에서 직접 수정한다.
 *    (afterLogin 레이아웃 바깥에 있는 페이지는 별도 헤더를 자체 구현한다.)
 */
const HIDE_PATHS = ["/browse", "/movies", "/latest", "/intro4", "/intro5"];

export default function ConditionalHeader() {
  const pathname = usePathname();
  if (HIDE_PATHS.includes(pathname)) return null;
  return (
    <header className="flex items-center px-6 py-4 bg-black border-b border-gray-800">
      <span className="text-white font-bold text-xl tracking-tight">K-Ride</span>
    </header>
  );
}
