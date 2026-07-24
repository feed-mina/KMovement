'use client';
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore, TravelPurpose } from "@/store/onboarding-store";

const PURPOSE_ITEMS: { key: TravelPurpose; label: string }[] = [
  { key: "food",     label: "맛집 탐방" },
  { key: "kculture", label: "K-컬처" },
  { key: "nature",   label: "자연 힐링" },
  { key: "history",  label: "역사 문화" },
  { key: "shopping", label: "쇼핑" },
  { key: "rest",     label: "휴식" },
];

const purposePageData = PURPOSE_ITEMS.map((p) => ({ purposeKey: p.key, name: p.label }));

function Intro4PageInner() {
  const router = useRouter();
  const { purposes } = useOnboardingStore();
  const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.INTRO4);
  const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO4, metadata, {});

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-white">로딩 중...</div>
          </div>
        ) : (
          <DynamicEngine
            metadata={metadata}
            screenId={SCREEN_IDS.INTRO4}
            pageData={{ purposeList: purposePageData }}
            formData={formData}
            onChange={handleChange}
            onAction={handleAction}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-6 py-4 flex items-center justify-between z-50">
        <span className="text-gray-400 text-sm">{purposes.length}개 선택됨</span>
        <button
          onClick={() => router.push("/intro5")}
          disabled={purposes.length < 1}
          className="px-8 py-3 bg-red-600 text-white font-bold rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function Intro4Page() {
  return (
    <Suspense fallback={null}>
      <Intro4PageInner />
    </Suspense>
  );
}
