'use client';
import { useEffect } from "react";

/**
 * Next.js App Router error boundary for /kpop/* routes.
 *
 * Catches any uncaught render errors in the kpop route tree and shows a
 * user-friendly recovery page instead of the generic "Application error"
 * page.  Errors are still logged to the browser console so they remain
 * visible during development.
 */
export default function KpopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[kpop] uncaught render error:", error);
  }, [error]);

  return (
    <main className="kpop-screen" role="main" aria-labelledby="kpop-error-heading">
      <h1 id="kpop-error-heading" className="kpop-error-title">
        K-POP 화면을 불러오지 못했습니다
      </h1>
      <p className="kpop-error-desc">
        잠시 후 다시 시도해 주세요.
        {error?.digest && (
          <span className="kpop-error-digest"> (오류 코드: {error.digest})</span>
        )}
      </p>
      <button
        type="button"
        className="kpop-error-retry"
        onClick={reset}
        aria-label="K-POP 화면 다시 불러오기"
      >
        다시 시도
      </button>
    </main>
  );
}
