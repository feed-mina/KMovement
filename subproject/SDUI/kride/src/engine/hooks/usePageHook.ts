'use client';
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageHook as useCorePageHook } from "@kride/core";

export const usePageHook = (
  screenId: string,
  metadata: any[],
  initialData: any = {}
) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? undefined;
  const code = searchParams.get("code") ?? undefined;

  // 코어 훅은 렌더 중 상태 보정을 하므로 어댑터/파라미터 참조를 고정한다
  // (모바일 [screenId].tsx와 같은 계약). 매 렌더 새 리터럴을 넘기면
  // 가드 비교가 헛돌아 불필요한 재렌더를 만든다.
  const navigation = useMemo(
    () => ({
      push: (url: string) => router.push(url),
      openExternal: (url: string) => window.location.assign(url),
    }),
    [router]
  );
  const routeParams = useMemo(() => ({ email, code }), [email, code]);

  return useCorePageHook(screenId, metadata, initialData, navigation, routeParams);
};
