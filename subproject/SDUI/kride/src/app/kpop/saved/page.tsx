'use client';

import DynamicEngine from '@/engine/DynamicEngine';
import { usePageHook } from '@/engine/hooks/usePageHook';
import { SCREEN_IDS } from '@/engine/screenMap';
import { useUiScreen } from '@kride/core';

const EMPTY = {};

export default function KpopSavedItemsPage() {
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
