'use client';
import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";

export default function KpopExplorePage() {
  const screenId = SCREEN_IDS.KPOP_EXPLORE;
  const { data: metadata = [], isLoading, error } = useUiScreen(screenId);
  const { data: pageData = {} } = useKpopPageData(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (isLoading) return <main className="kpop-screen"><p>Loading K-POP travel...</p></main>;
  if (error) return <main className="kpop-screen"><p>Could not load K-POP screen.</p></main>;

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
