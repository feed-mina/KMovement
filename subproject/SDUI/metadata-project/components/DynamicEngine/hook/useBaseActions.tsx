'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { flattenMetadata } from "../..//utils/metadataUtils";
import { useAuth } from "@/context/AuthContext";

// @@@@ useBaseActions 역할 : 모든 페이지에서 공통으로 쓰는 기능, 화면의 기억과 상태 관리 : 화면에 보이는 이벽창에 사용자가 무엇을 적었는지 혹은 서버에서 가져온 데이터를 어떻게 보관할지 담당한다, 데이터의 초기화외 동기화
// * initialData(조회데이터) 가 오면 그걸 현재 입력 폼(formData) 에 넣는다. (ex 수정화면에서 기존 내용을 볼수있다)

const KRIDE_STORAGE_KEY = 'kride_form';
const isKrideScreen = (id: string) => id.startsWith('KRIDE_');

// screenId를 인자에 추가해서 어떤 페이지인지 알 수 있게 해
export const useBaseActions = (screenId: string, metadata: any[] = [], initialData: any = {}) => {
    const [formData, setFormData] = useState<any>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const base = {
                reg_email: params.get("email") || "",
                reg_code: params.get("code") || "",
                email: params.get("email") || "",
                code: params.get("code") || ""
            };
            if (isKrideScreen(screenId)) {
                try {
                    const saved = localStorage.getItem(KRIDE_STORAGE_KEY);
                    if (saved) return { ...base, ...JSON.parse(saved) };
                } catch {}
            }
            return base;
        }
        return {};
    });
    const [showPassword, setShowPassword] = useState(false);
    const [pwType, setPwType] = useState("password");

    const [prevMetadata, setPrevMetadata] = useState(metadata);
    const [baseInitialData, setBaseInitialData] = useState(initialData);

    // 1. Metadata가 바뀌면 (화면 이동 시) 폼 데이터 초기화
    if (metadata !== prevMetadata) {
        setPrevMetadata(metadata);
        // KRIDE 화면은 localStorage에서 복원하므로 초기화하지 않음
        if (!isKrideScreen(screenId)) {
            const params = new URLSearchParams(window.location.search);
            const urlEmail = params.get("email");
            const UrlCode = params.get("code");
            if (!urlEmail) {
                setFormData({});
            } else {
                setFormData({ reg_email: urlEmail, email: urlEmail, reg_code: UrlCode, code: UrlCode });
            }
        }
    }

    // 2. * 초기화값이 들어오면 (데이터 로드 성공 시) 폼 데이터 채우기
    if (initialData !== baseInitialData && Object.keys(initialData).length > 0) {
        // * 초기화 값을 상태로 갖는다.
        setBaseInitialData(initialData);

        setFormData((prev: any) => ({
            ...initialData,
            ...prev
        }));
    }
    // * 입력값의 현재 상태는 formData 의 현재 상태를 즉시 반영한다
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);


    const handleChange = useCallback((id: string, value: any) => {
        setFormData((prev: any) => {
            const updated = { ...prev, [id]: value };
            if (isKrideScreen(screenId) && typeof window !== 'undefined') {
                try { localStorage.setItem(KRIDE_STORAGE_KEY, JSON.stringify(updated)); } catch {}
            }
            return updated;
        });
    }, [screenId]);


    const togglePassword = useCallback(() => {
        setShowPassword(prev => !prev);
        setPwType(prev => prev === "password" ? "text" : "password");
    }, []);

    const { checkAccess } = useAuth();
    // 메타데이터 규격화 함수
    const getMetaInfo = useCallback((meta: any) => {
        if (!meta) return null;

        // * 메타데이터에 정의된 권한 정보 가져오기
        const allowedRoles = meta.allowed_roles || meta.allowedRoles;
        return {
            actionType: meta.action_type || meta.actionType,
            actionUrl: meta.action_url || meta.actionUrl,
            componentId: meta.component_id || meta.componentId,
            dataSqlKey: meta.data_sql_key || meta.dataSqlKey,
            isAllowed: checkAccess(allowedRoles),
            currentData: formDataRef.current
        };
    }, [checkAccess]);
    // 모든 컴포넌트를 한줄로 쭉 세워서 확인이 필요, 구조를 일렬로 펴줌
    const flatMeta = useMemo(() => flattenMetadata(metadata), [metadata]);

    return {
        formData, setFormData, formDataRef, handleChange,
        flatMeta, showPassword, pwType, togglePassword, getMetaInfo
    };
};