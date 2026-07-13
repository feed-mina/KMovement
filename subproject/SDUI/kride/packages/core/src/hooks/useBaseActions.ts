'use client';
import { useState, useCallback, useRef, useEffect } from "react";

export const useBaseActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {}
) => {
  const [formData, setFormData] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return {
        email: params.get("email") || "",
        code: params.get("code") || "",
      };
    }
    return {};
  });

  const [showPassword, setShowPassword] = useState(false);
  const [pwType, setPwType] = useState("password");
  const [prevMetadata, setPrevMetadata] = useState(metadata);
  const [baseInitialData, setBaseInitialData] = useState(initialData);

  if (metadata !== prevMetadata) {
    setPrevMetadata(metadata);
    const params = new URLSearchParams(window.location.search);
    const urlEmail = params.get("email");
    const urlCode = params.get("code");
    if (!urlEmail) {
      setFormData({});
    } else {
      setFormData({ email: urlEmail, code: urlCode });
    }
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
