'use client';
import { useRouter } from "next/navigation";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore, TravelPurpose } from "@/store/onboarding-store";
import OnboardingPageShell from "@/components/kride/OnboardingPageShell";

const PURPOSE_ITEMS: { key: TravelPurpose; label: string }[] = [
  { key: "food",     label: "맛집 탐방" },
  { key: "kculture", label: "K-컬처" },
  { key: "nature",   label: "자연 힐링" },
  { key: "history",  label: "역사 문화" },
  { key: "shopping", label: "쇼핑" },
  { key: "rest",     label: "휴식" },
];

const purposePageData = PURPOSE_ITEMS.map((p) => ({ purposeKey: p.key, name: p.label }));

export default function Intro4Page() {
  const router = useRouter();
  const { purposes } = useOnboardingStore();
  const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.INTRO4);
  const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO4, metadata, {});

  return (
    <OnboardingPageShell
      bottomBar={
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{purposes.length}개 선택됨</span>
          <button
            onClick={() => router.push("/intro5")}
            disabled={purposes.length < 1}
            className="px-8 py-3 bg-red-600 text-white font-bold rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
          >
            다음 →
          </button>
        </div>
      }
    >
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
    </OnboardingPageShell>
  );
}
