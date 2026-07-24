'use client';
import { Suspense } from "react";

import DynamicEngine from '@/engine/DynamicEngine';
import { usePageHook } from '@/engine/hooks/usePageHook';
import { SCREEN_IDS } from '@/engine/screenMap';
import { useUiScreen } from '@kride/core';

const EMPTY = {};

function KpopSavedItemsPageInner() {
  const screenId = SCREEN_IDS.KPOP_SAVED_ITEMS;
  const { data: metadata = [], isLoading, error } = useUiScreen(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, EMPTY);

  if (isLoading) return <main className="kpop-screen"><p>저장 목록을 준비하고 있어요.</p></main>;
  if (error) return <main className="kpop-screen"><p>저장 목록 화면을 불러오지 못했습니다.</p></main>;

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={screenId}
      pageData={EMPTY}
      formData={formData}
      onChange={handleChange}
      onAction={handleAction}
      apiBase=""
    />
  );
}

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function KpopSavedItemsPage() {
  return (
    <Suspense fallback={null}>
      <KpopSavedItemsPageInner />
    </Suspense>
  );
}
