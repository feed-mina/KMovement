'use client';
import { Suspense } from "react";
import { useEffect, useMemo, useState } from 'react';
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import Pagination from '@/components/fields/Pagination';
import { useKpopPageData, useUiScreen } from "@kride/core";

function KpopExplorePageInner() {
  const screenId = SCREEN_IDS.KPOP_EXPLORE;
  const { data: metadata = [], isLoading: isMetadataLoading, error: metadataError } = useUiScreen(screenId);
  const { data: pageData = {}, isLoading: isDataLoading, error: dataError } = useKpopPageData(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});
  const [currentPage, setCurrentPage] = useState(1);
  const artists = Array.isArray((pageData as Record<string, any>)?.artists) ? (pageData as Record<string, any>).artists : [];
  const pageSize = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [artists.length]);

  const visiblePageData = useMemo(() => ({
    ...pageData,
    artists: artists.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  }), [pageData, artists, currentPage]);

  if (isMetadataLoading || isDataLoading) return <main className="kpop-screen"><p>Loading K-POP travel...</p></main>;
  if (metadataError || dataError) return <main className="kpop-screen"><p>Could not load K-POP screen.</p></main>;

  return (
    <>
      <DynamicEngine
        metadata={metadata}
        screenId={screenId}
        pageData={visiblePageData}
        formData={formData}
        onChange={handleChange}
        onAction={handleAction}
      />
      <Pagination
        totalCount={artists.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  );
}

// usePageHook가 내부에서 useSearchParams를 쓰므로 정적 프리렌더에는 Suspense
// 경계가 필요하다(missing-suspense-with-csr-bailout). 클라이언트 페이지의
// force-dynamic export는 Next 14가 무시하므로 이 구조가 표준 해법이다.
export default function KpopExplorePage() {
  return (
    <Suspense fallback={null}>
      <KpopExplorePageInner />
    </Suspense>
  );
}
