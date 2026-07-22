'use client';

import DynamicEngine from '@/engine/DynamicEngine';
import { usePageHook } from '@/engine/hooks/usePageHook';
import { SCREEN_IDS } from '@/engine/screenMap';
import { useUiScreen } from '@kride/core';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function KpopAiResultPage() {
  const screenId = SCREEN_IDS.KPOP_AI_RESULT;
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || '';
  const pageData = useMemo(() => ({ jobId }), [jobId]);
  const { data: metadata = [], isLoading, error } = useUiScreen(screenId);
  const { formData, handleChange, handleAction } = usePageHook(screenId, metadata, {});

  if (isLoading) return <main className="kpop-screen"><p>분석 결과 화면을 준비하고 있어요.</p></main>;
  if (error) return <main className="kpop-screen"><p>분석 결과 화면을 불러오지 못했습니다.</p></main>;

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
