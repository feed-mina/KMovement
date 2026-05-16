'use client';
import { useState, useEffect, useCallback } from 'react';

// KRIDE_WARNING: SelectionCard에서 kride-warning 커스텀 이벤트 수신 → 하단 토스트 표시
export default function KrideWarningToast() {
  const [message, setMessage] = useState<string | null>(null);

  const handleWarning = useCallback((e: Event) => {
    const msg = (e as CustomEvent<{ msg: string }>).detail?.msg ?? "선택 한도를 초과했습니다";
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  useEffect(() => {
    window.addEventListener('kride-warning', handleWarning);
    return () => window.removeEventListener('kride-warning', handleWarning);
  }, [handleWarning]);

  if (!message) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 text-white text-sm px-5 py-3 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
      {message}
    </div>
  );
}
