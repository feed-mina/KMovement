'use client';

import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";
import { useSearchParams } from "next/navigation";

export default function KpopArtistDetailPage() {
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
