'use client';
import { Suspense } from "react";

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import DynamicEngine from '@/engine/DynamicEngine';
import { usePageHook } from '@/engine/hooks/usePageHook';
import { SCREEN_IDS } from '@/engine/screenMap';
import { useUiScreen } from '@kride/core';

function KpopProductsPageInner() {
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

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function KpopProductsPage() {
  return (
    <Suspense fallback={null}>
      <KpopProductsPageInner />
    </Suspense>
  );
}
