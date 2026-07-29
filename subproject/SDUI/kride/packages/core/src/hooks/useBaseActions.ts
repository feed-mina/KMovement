'use client';
import { useState, useCallback, useRef, useEffect } from "react";
import type { RuntimeConfig } from "../config/runtimeConfig";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const shallowEqual = (a: Record<string, any>, b: Record<string, any>) => {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
};

export const useBaseActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {},
  routeParams: RuntimeConfig["routeParams"] = {}
) => {
  const routeEmail = firstParam(routeParams.email);
  const routeCode = firstParam(routeParams.code);
  const routeKey = JSON.stringify([routeEmail, routeCode]);

  const [formData, setFormData] = useState<any>(() =>
    routeEmail ? { email: routeEmail, code: routeCode } : {}
  );

  const [showPassword, setShowPassword] = useState(false);
  const [pwType, setPwType] = useState("password");
  const [prevMetadata, setPrevMetadata] = useState(metadata);
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  const [baseInitialData, setBaseInitialData] = useState(initialData);

  // 렌더 중 상태 보정(adjusting state during render)은 비교가 수렴해야 한다.
  // 호출부는 매 렌더 새 참조를 넘길 수 있으므로(react-query의 `data = []`
  // 기본값, 웹 usePageHook의 searchParams 리터럴) 참조가 아니라 내용으로
  // 비교한다 — 참조 비교는 배포 웹에서 무한 렌더 루프(React #301)를 냈다.
  if (metadata !== prevMetadata && (metadata.length > 0 || prevMetadata.length > 0)) {
    setPrevMetadata(metadata);
    setFormData(routeEmail ? { email: routeEmail, code: routeCode } : {});
  }

  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    setFormData(routeEmail ? { email: routeEmail, code: routeCode } : {});
  }

  if (initialData !== baseInitialData && !shallowEqual(initialData, baseInitialData)) {
    setBaseInitialData(initialData);
    if (Object.keys(initialData).length > 0) {
      setFormData((prev: any) => ({ ...initialData, ...prev }));
    }
  }

  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const handleChange = useCallback((id: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [id]: value }));
  }, []);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
    setPwType((prev) => (prev === "password" ? "text" : "password"));
  }, []);

  const getMetaInfo = useCallback((meta: any) => {
    if (!meta) return null;
    return {
      actionType: meta.action_type || meta.actionType,
      actionUrl: meta.action_url || meta.actionUrl,
      componentId: meta.component_id || meta.componentId,
      dataSqlKey: meta.data_sql_key || meta.dataSqlKey,
      currentData: formDataRef.current,
    };
  }, []);

  return {
    formData,
    setFormData,
    formDataRef,
    handleChange,
    showPassword,
    pwType,
    togglePassword,
    getMetaInfo,
  };
};
