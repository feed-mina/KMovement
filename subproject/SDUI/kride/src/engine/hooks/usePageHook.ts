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

  // navigation/routeParams 를 인라인 객체로 넘기면 매 렌더 새 참조가 되어
  // 하위 훅의 메모이제이션이 전부 무효화된다. 값이 바뀔 때만 새 객체를 만든다.
  const navigation = useMemo(
    () => ({
      push: router.push,
      openExternal: (url: string) => window.location.assign(url),
    }),
    [router]
  );

  const routeParams = useMemo(() => ({ email, code }), [email, code]);

  return useCorePageHook(screenId, metadata, initialData, navigation, routeParams);
};
