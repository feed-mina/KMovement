'use client';
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { useUiScreen } from "@/engine/hooks/useUiScreen";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useOnboardingStore } from "@/store/onboarding-store";

// const ARTIST_LIST = [
//   { id: 1,  name: "BTS",        imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 2,  name: "블랙핑크",    imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 3,  name: "뉴진스",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 4,  name: "아이브",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 5,  name: "세븐틴",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 6,  name: "에스파",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 7,  name: "엔믹스",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 8,  name: "스트레이키즈", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 9,  name: "트와이스",    imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 10, name: "레드벨벳",    imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 11, name: "GOT7",       imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 12, name: "2PM",        imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 13, name: "샤이니",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 14, name: "소녀시대",    imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 15, name: "엑소",        imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 16, name: "몬스타엑스",  imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 17, name: "있지",        imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 18, name: "르세라핌",    imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 19, name: "케플러",      imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
//   { id: 20, name: "제로베이스원", imageUrl: "https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" },
// ];

export default function MoviesPage() {
  const { data } = useQuery({
    queryKey: ['artists'],
    queryFn: () => fetch(`/kride-api/artists`)
                    .then(r => r.json()),
    staleTime: 1000 * 60 * 60,  // 1시간 캐시
  });
  const artistList = data?.artists ?? [];

  const router = useRouter();
  const { selectedArtists } = useOnboardingStore();
  const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.INTRO2);
  const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO2, metadata, {});

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
            screenId={SCREEN_IDS.INTRO2}
            pageData={{ artistList: artistList }}
            formData={formData}
            onChange={handleChange}
            onAction={handleAction}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-6 py-4 flex items-center justify-between z-50">
        <span className="text-gray-400 text-sm">{selectedArtists.length} / 5 선택됨</span>
        <button
          onClick={() => router.push("/latest")}
          disabled={selectedArtists.length < 1}
          className="px-8 py-3 bg-red-600 text-white font-bold rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
