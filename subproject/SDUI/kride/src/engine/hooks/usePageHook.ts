'use client';
import { useRouter, useSearchParams } from "next/navigation";
import { usePageHook as useCorePageHook } from "@kride/core";

export const usePageHook = (
  screenId: string,
  metadata: any[],
  initialData: any = {}
) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  return useCorePageHook(screenId, metadata, initialData, {
    push: router.push,
    openExternal: (url) => window.location.assign(url),
  }, {
    email: searchParams.get("email") ?? undefined,
    code: searchParams.get("code") ?? undefined,
  });
};
