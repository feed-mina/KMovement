'use client';
import { Suspense } from "react";
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";

function KpopEventsPageInner() {
  const screenId = SCREEN_IDS.KPOP_EVENTS;
  const { data: metadata = [], isLoading: isMetadataLoading, error: metadataError } = useUiScreen(screenId);
  const { data: pageData = {}, isLoading: isDataLoading, error: dataError } = useKpopPageData(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (isMetadataLoading || isDataLoading) return <main className="kpop-screen"><p>Loading K-POP events...</p></main>;
  if (metadataError || dataError) return <main className="kpop-screen"><p>Could not load K-POP events.</p></main>;

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
export default function KpopEventsPage() {
  return (
    <Suspense fallback={null}>
      <KpopEventsPageInner />
    </Suspense>
  );
}
