'use client';
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";

export default function KpopExplorePage() {
  const screenId = SCREEN_IDS.KPOP_EXPLORE;
  const { data: metadata = [], isLoading: isMetadataLoading, error: metadataError } = useUiScreen(screenId);
  const { data: pageData = {}, isLoading: isDataLoading, error: dataError } = useKpopPageData(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (isMetadataLoading || isDataLoading) return <main className="kpop-screen"><p>Loading K-POP travel...</p></main>;
  if (metadataError || dataError) return <main className="kpop-screen"><p>Could not load K-POP screen.</p></main>;

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
