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
  const [formData, setFormData] = useState<any>(() => {
    const email = firstParam(routeParams.email);
    const code = firstParam(routeParams.code);
    return email ? { email, code } : {};
  });

  const [showPassword, setShowPassword] = useState(false);
  const [pwType, setPwType] = useState("password");
  const [prevMetadata, setPrevMetadata] = useState(metadata);
  const [prevRouteParams, setPrevRouteParams] = useState(routeParams);
  const [baseInitialData, setBaseInitialData] = useState(initialData);

  if (metadata !== prevMetadata) {
    setPrevMetadata(metadata);
    const urlEmail = firstParam(routeParams.email);
    const urlCode = firstParam(routeParams.code);
    if (!urlEmail) {
      setFormData({});
    } else {
      setFormData({ email: urlEmail, code: urlCode });
    }
  }

  if (routeParams !== prevRouteParams) {
    setPrevRouteParams(routeParams);
    const email = firstParam(routeParams.email);
    const code = firstParam(routeParams.code);
    setFormData(email ? { email, code } : {});
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
