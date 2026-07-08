'use client';

import { useCallback, useEffect, useState } from 'react';

export default function KrideWarningToast() {
  const [message, setMessage] = useState<string | null>(null);

  const handleWarning = useCallback((event: Event) => {
    const msg = (event as CustomEvent<{ msg: string }>).detail?.msg ?? '선택 조건을 조금 줄여볼까요?';
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  useEffect(() => {
    window.addEventListener('kride-warning', handleWarning);
    return () => window.removeEventListener('kride-warning', handleWarning);
  }, [handleWarning]);

  if (!message) return null;

  return (
    <div className="kride-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
