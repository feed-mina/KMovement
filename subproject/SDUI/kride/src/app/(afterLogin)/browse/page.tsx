'use client';
import { Suspense } from "react";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";

function BrowsePageInner() {
  const { data: metadata = [], isLoading, error } = useUiScreen(SCREEN_IDS.INTRO1);
  const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO1, metadata, {});

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error || metadata.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 px-6">
        <p className="text-3xl font-bold text-white text-center">어떤 여행을 떠나실 건가요?</p>
        <p className="text-gray-400 text-base text-center">여행 기간을 선택해주세요</p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {(["당일치기", "1박 2일", "2박 3일"] as const).map((label) => (
            <button
              key={label}
              onClick={() => handleAction({ actionType: "SET_DURATION", labelText: label }, { value: label === "당일치기" ? "day" : label === "1박 2일" ? "onenight" : "twonight" })}
              className="px-8 py-4 text-lg font-bold rounded-full border-2 border-red-600 text-red-500 hover:bg-red-600 hover:text-white transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={SCREEN_IDS.INTRO1}
      pageData={{}}
      formData={formData}
      onChange={handleChange}
      onAction={handleAction}
    />
  );
}

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowsePageInner />
    </Suspense>
  );
}
