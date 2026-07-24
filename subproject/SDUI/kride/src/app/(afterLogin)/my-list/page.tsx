'use client';
import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore } from "@/store/onboarding-store";

const DURATION_LABEL: Record<string, string> = {
  day: "당일치기",
  onenight: "1박 2일",
  twonight: "2박 3일",
};

const PURPOSE_LABEL: Record<string, string> = {
  food: "맛집",
  kculture: "K-컬처",
  nature: "자연",
  history: "역사",
  shopping: "쇼핑",
  rest: "휴식",
};

function MyListPageInner() {
  const router = useRouter();
  const { duration, selectedArtists, selectedRegions, purposes, budget } =
    useOnboardingStore();
  const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.MY_LIST);
  const pageData = { duration, selectedArtists, selectedRegions, purposes, budget };
  const { formData, handleChange, handleAction } = usePageHook(
    SCREEN_IDS.MY_LIST,
    metadata,
    pageData
  );

  useEffect(() => {
    if (duration === null) {
      router.replace("/browse");
    }
  }, [duration, router]);

  if (duration === null) return null;

  const summaryUI = (
    <div className="min-h-screen bg-black text-white px-6 py-10 flex flex-col gap-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">나의 여행 요약</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">여행 기간</h2>
        <p className="text-xl text-white font-medium">{DURATION_LABEL[duration]}</p>
      </section>

      {selectedArtists.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            아티스트 ({selectedArtists.length}명)
          </h2>
          <div className="flex flex-wrap gap-2">
            {selectedArtists.map((a) => (
              <span
                key={a.id}
                className="px-3 py-1 bg-gray-800 rounded-full text-sm text-white"
              >
                {a.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {selectedRegions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            지역 ({selectedRegions.length}곳)
          </h2>
          <div className="flex flex-wrap gap-2">
            {selectedRegions.map((r) => (
              <span
                key={r.id}
                className="px-3 py-1 bg-gray-800 rounded-full text-sm text-white"
              >
                {r.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {purposes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            여행 목적
          </h2>
          <div className="flex flex-wrap gap-2">
            {purposes.map((p) => (
              <span
                key={p}
                className="px-3 py-1 bg-red-900 border border-red-600 rounded-full text-sm text-white"
              >
                {PURPOSE_LABEL[p] ?? p}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">예산</h2>
        <p className="text-white text-base">
          ₩{budget.min.toLocaleString("ko-KR")} ~ ₩{budget.max.toLocaleString("ko-KR")}
        </p>
      </section>

      <button
        data-testid="ai-banner-btn"
        onClick={() => router.push("/focus")}
        className="w-full py-6 rounded-2xl bg-gradient-to-r from-red-700 to-red-500 text-2xl font-bold hover:opacity-90 transition-opacity text-white"
      >
        ✨ AI 여행 일정 보기
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-white text-lg">로딩 중...</div>
      </div>
    );
  }

  if (metadata.length === 0) {
    return summaryUI;
  }

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={SCREEN_IDS.MY_LIST}
      pageData={pageData}
      formData={formData}
      onChange={handleChange}
      onAction={handleAction}
    />
  );
}

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function MyListPage() {
  return (
    <Suspense fallback={null}>
      <MyListPageInner />
    </Suspense>
  );
}
