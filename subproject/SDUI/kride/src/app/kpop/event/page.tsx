'use client';

import DynamicEngine from "@/engine/DynamicEngine";
import { usePageHook } from "@/engine/hooks/usePageHook";
import { SCREEN_IDS } from "@/engine/screenMap";
import { useKpopPageData, useUiScreen } from "@kride/core";
import { useSearchParams } from "next/navigation";

export default function KpopEventDetailPage() {
  const screenId = SCREEN_IDS.KPOP_EVENT_DETAIL;
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const { data: metadata = [], isLoading: isMetadataLoading, error: metadataError } = useUiScreen(screenId);
  const {
    data: pageData = {},
    isLoading: isDataLoading,
    error: dataError,
  } = useKpopPageData(screenId, "", { eventId });
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (!eventId) {
    return <main className="kpop-screen"><p>Select an event from the K-POP events page.</p></main>;
  }
  if (isMetadataLoading || isDataLoading) {
    return <main className="kpop-screen"><p>Loading event details...</p></main>;
  }
  if (metadataError || dataError) {
    return <main className="kpop-screen"><p>Could not load this event.</p></main>;
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
