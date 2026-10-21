'use client';

import { useRouter } from 'next/navigation';

export default function FocusFooterBar() {
    const router = useRouter();

    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#161616] border-t border-gray-800 flex justify-around items-center z-[200]">
            <button 
                onClick={() => router.push('/')} 
                className="flex flex-col items-center justify-center w-full h-full gap-1 text-gray-400 hover:text-white transition-colors"
            >
                <span className="text-xl">🏠</span>
                <span className="text-[10px] font-semibold">홈</span>
            </button>
            {/* 2026-10-21: 커뮤니티 진입 경로는 우선 숨김(display:none) */}
            <button 
                hidden
                onClick={() => router.push('/view/COMMUNITY_LIST')} 
                className="kride-entry-hidden flex flex-col items-center justify-center w-full h-full gap-1 text-gray-400 hover:text-white transition-colors"
            >
                <span className="text-xl">💬</span>
                <span className="text-[10px] font-semibold">커뮤니티</span>
            </button>
            <button 
                onClick={() => router.push('/view/SET_TIME_PAGE')} 
                className="flex flex-col items-center justify-center w-full h-full gap-1 text-gray-400 hover:text-white transition-colors"
            >
                <span className="text-xl">⏰</span>
                <span className="text-[10px] font-semibold">시간 설정</span>
            </button>
        </div>
    );
}
