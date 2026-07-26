'use client';
import { useState, useCallback, useRef, useEffect } from "react";
import type { RuntimeConfig } from "../config/runtimeConfig";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export const useBaseActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {},
  routeParams: RuntimeConfig["routeParams"] = {}
) => {
  const routeEmail = firstParam(routeParams.email);
  const routeCode = firstParam(routeParams.code);
  // routeParams 는 호출부에서 매 렌더 새 객체 리터럴로 만들어질 수 있다.
  // 참조로 비교하면 항상 "변경됨"이 되어 렌더 중 setState 가 무한 반복되고
  // React #301(Too many re-renders)로 화면 전체가 죽는다. 값 기준 키로 비교한다.
  const routeKey = JSON.stringify([routeEmail, routeCode]);

  const [formData, setFormData] = useState<any>(() =>
    routeEmail ? { email: routeEmail, code: routeCode } : {}
  );

  const [showPassword, setShowPassword] = useState(false);
  const [pwType, setPwType] = useState("password");
  const [prevMetadata, setPrevMetadata] = useState(metadata);
  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  const [baseInitialData, setBaseInitialData] = useState(initialData);

  // 빈 metadata 사이의 교체는 화면 전환이 아니다. 호출부가 `data = []` 형태의
  // 기본값을 쓰면 로딩 중 매 렌더 새 배열이 들어오므로 같은 루프에 빠진다.
  if (metadata !== prevMetadata && !(metadata.length === 0 && prevMetadata.length === 0)) {
    setPrevMetadata(metadata);
    setFormData(routeEmail ? { email: routeEmail, code: routeCode } : {});
  }

  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    setFormData(routeEmail ? { email: routeEmail, code: routeCode } : {});
  }

  if (initialData !== baseInitialData && Object.keys(initialData).length > 0) {
    setBaseInitialData(initialData);
    setFormData((prev: any) => ({ ...initialData, ...prev }));
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
