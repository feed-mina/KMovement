'use client';
import { Suspense } from "react";

import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";
import { useSearchParams } from "next/navigation";

function KpopArtistDetailPageInner() {
  const screenId = SCREEN_IDS.KPOP_ARTIST_DETAIL;
  const searchParams = useSearchParams();
  const artistId = searchParams.get("artistId");
  const { data: metadata = [], isLoading: isMetadataLoading, error: metadataError } = useUiScreen(screenId);
  const {
    data: pageData = {},
    isLoading: isDataLoading,
    error: dataError,
  } = useKpopPageData(screenId, "", { artistId });
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (!artistId) {
    return <main className="kpop-screen"><p>Select an artist from the K-POP explore page.</p></main>;
  }
  if (isMetadataLoading || isDataLoading) {
    return <main className="kpop-screen"><p>Loading artist details...</p></main>;
  }
  if (metadataError || dataError) {
    return <main className="kpop-screen"><p>Could not load this artist.</p></main>;
  }

  return (
    <DynamicEngine
      metadata={metadata}
      screenId={screenId}
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
export default function KpopArtistDetailPage() {
  return (
    <Suspense fallback={null}>
      <KpopArtistDetailPageInner />
    </Suspense>
  );
}
