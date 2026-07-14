// usePageHook.ts
import { useUserActions } from "./useUserActions";
import { useBusinessActions } from "./useBusinessActions";
import {useCallback} from "react";

// @@@@ usePageHook역할: 도메인에 따라서 userActions나 businessActions으로 액션 핸들러 분기
// usePageHook.ts 리팩토링
export const usePageHook = (screenId: string, metadata: any[], initialData: any) => {
    const userActions = useUserActions(screenId, metadata, initialData);
    const businessActions = useBusinessActions(screenId, metadata, initialData);

    // 통합 핸들러 생성
    const combinedHandleAction = useCallback(async (meta: any, data?: any) => {
        const actionType = meta.action_type || meta.actionType;

        // 1. 공통/인증 관련 액션은 userActions에 먼저 물어봄
        const userActionTypes = [
            "LOGIN_SUBMIT", "LOGOUT", "KAKAO_LOGOUT",
            "REGISTER_SUBMIT", "CHECK_USER_ID", "SUBMIT_ADDITIONAL_INFO",
            "VERIFY_CODE", "SOS", "TOGGLE_PW", "OPEN_POSTCODE"
        ];

        if (userActionTypes.includes(actionType)) {
            return await userActions.handleAction(meta, data);
        }

        // 2. 그 외 데이터 관련 액션은 businessActions가 처리함
        return await businessActions.handleAction(meta, data);
    }, [userActions, businessActions]);

    // 결정된 훅 세트를 반환하되, 핸들러만 통합 버전으로 교체
    const isUserDomain =
        screenId === "REGISTER_PAGE" ||
        screenId === "ADDITIONAL_INFO_PAGE" ||
        screenId.includes("LOGIN");
    const targetActions = isUserDomain ? userActions : businessActions;

    return {
        ...targetActions,
        handleAction: combinedHandleAction, // 통합 핸들러로 덮어쓰기!
        activeModal: userActions.activeModal,
        closeModal: userActions.closeModal
    };
};
