'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import DynamicEngine from '@/engine/DynamicEngine';
import { usePageHook } from '@/engine/hooks/usePageHook';
import { SCREEN_IDS } from '@/engine/screenMap';
import { useUiScreen } from '@kride/core';

export default function KpopProductsPage() {
  const screenId = SCREEN_IDS.KPOP_PRODUCTS;
  const searchParams = useSearchParams();
  const pageData = useMemo(() => ({
    q: searchParams.get('q') || '',
    artistId: searchParams.get('artistId') || '',
    eventId: searchParams.get('eventId') || '',
  }), [searchParams]);
  const { data: metadata = [], isLoading, error } = useUiScreen(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (isLoading) return <main className="kpop-screen"><p>상품 후보 검색을 준비하고 있어요.</p></main>;
  if (error) return <main className="kpop-screen"><p>상품 후보 검색 화면을 불러오지 못했습니다.</p></main>;

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={screenId}
      pageData={pageData}
      formData={formData}
      onChange={handleChange}
      onAction={handleAction}
      apiBase=""
    />
  );
}
