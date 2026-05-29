'use client';
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore } from "@/store/onboarding-store";

// const REGION_LIST = [
//   { id: 1,  name: "서울", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 2,  name: "경기", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 3,  name: "강원", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 4,  name: "충북", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 5,  name: "충남", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 6,  name: "경북", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 7,  name: "경남", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 8,  name: "전북", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 9,  name: "전남", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 10, name: "제주", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
// ];

export default function LatestPage() {
  const { data } = useQuery({
  queryKey: ['regions'],
  queryFn: () => fetch(`/kride-api/regions`)
                   .then(r => r.json()),
  staleTime: 1000 * 60 * 60,
});
const regionList = data?.regions ?? [];

  const router = useRouter();
  const { selectedRegions } = useOnboardingStore();
  const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.INTRO3);
  const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO3, metadata, {});

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
            screenId={SCREEN_IDS.INTRO3}
            pageData={{ regionList: regionList }}
            formData={formData}
            onChange={handleChange}
            onAction={handleAction}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-6 py-4 flex items-center justify-between z-50">
        <span className="text-gray-400 text-sm">{selectedRegions.length} / 5 선택됨</span>
        <button
          onClick={() => router.push("/intro4")}
          disabled={selectedRegions.length < 1}
          className="px-8 py-3 bg-red-600 text-white font-bold rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
