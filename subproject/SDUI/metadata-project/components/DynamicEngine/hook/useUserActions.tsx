
import {useCallback, useEffect, useState} from "react";
import { useRouter } from "next/navigation";
import axios from "@/services/axios";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useBaseActions } from "./useBaseActions";
import { handleError, extractErrorMessage } from "@/utils/errorHandler";
import { formatKoreanPhoneNumber, isValidKoreanMobileNumber } from "@/lib/formatters/phone";


//  @@@@ useUserActions 역할 : 메타데이터의 action_type에 따라 각 타입 설명
export const useUserActions = (screenId: string,metadata: any[] = [], initialData: any = {}) => {
    const base = useBaseActions(screenId, metadata, initialData);
    const router = useRouter();
    const { user,login, logout } = useAuth();
    const { sendMessage } = useWebSocket();
    //  모달 열기 상태
    const [activeModal, setActiveModal] = useState<string | null>(null);

// 모달 닫기 함수
    const closeModal = () => setActiveModal(null);

    // [이동] 회원 전용 URL 파라미터 감지 로직
    useEffect(() => {
        const targetScreens = ['REGISTER_PAGE', 'VERIFY_CODE_PAGE'];
        if (typeof window !== "undefined" && targetScreens.includes(screenId)) {
            const params = new URLSearchParams(window.location.search);
            const emailFromUrl = params.get("email");
            if (emailFromUrl) {
                base.setFormData((prev: any) => ({
                    ...prev,
                    reg_email: emailFromUrl,
                    email: emailFromUrl
                }));
            }
        }
    }, [screenId, base.setFormData]);
    const handleAction = useCallback(async (meta: any, data?: any) => {
        const info = base.getMetaInfo(meta);
        if (!info) return;

        const { actionType, actionUrl, currentData } = info;

        // * 현재 입력값 상태
        const currentFormData = base.formDataRef.current;

        const componentId = meta.component_id;


        switch (actionType) {
            case "LOGIN_SUBMIT":
                try {
                    const loginData = {
                        user_email: `${currentData.user_email}@${currentData.user_email_domain}`,
                        user_pw: currentData.user_pw
                    };
                    const res = await axios.post(actionUrl || '/api/auth/login', loginData);
                    if (res.status === 200) {
                        // LoginResponse는 jwt만 포함 → role이 없음
                        // /api/auth/me로 전체 사용자 정보(role 포함) 재조회
                        const userRes = await axios.get('/api/auth/me');
                        login(userRes.data);
                        alert("로그인 성공!");
                        router.push('/view/MAIN_PAGE');
                    }
                } catch (error: any) {
                    handleError(error, 'LOGIN_SUBMIT', '로그인 정보가 올바르지 않습니다');
                }
                break;
            case "REGISTER_SUBMIT":
                try {
                    const userId = String(currentFormData.userId ?? '').trim();
                    if (!/^[A-Za-z0-9_]{4,20}$/.test(userId)) {
                        alert('아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요.');
                        return;
                    }
                    if (!currentFormData._userIdChecked || currentFormData._checkedUserId !== userId) {
                        alert('아이디 중복 확인을 완료해주세요.');
                        return;
                    }

                    //   데이터 가공 (reg_ 접두어 제거)
                    const submitData = Object.keys(currentFormData).reduce((acc: any, key) => {
                        if (key.startsWith('_')) return acc;
                        const cleanKey = key.startsWith('reg_') ? key.replace('reg_', '') : key;
                        acc[cleanKey] = currentFormData[key];
                        return acc;
                    }, {});
                    submitData.userId = userId;
                    submitData.phone = formatKoreanPhoneNumber(submitData.phone);
                    if (!isValidKoreanMobileNumber(submitData.phone)) {
                        alert('휴대폰 번호를 010-1234-5678 형식으로 입력해주세요.');
                        return;
                    }

                    // 2. 가입 API 호출
                    const res = await axios.post(actionUrl || '/api/auth/register', submitData);

                    // 3. 성공한 경우에만 인증 메일 발송 및 페이지 이동
                    if (res.status === 201 || res.status === 200) {
                        // 계정 생성과 메일 발송은 별개다. 메일 장애가 이미 생성된
                        // 계정을 '회원가입 실패'로 보이게 하지 않도록 분리한다.
                        let mailSent = false;
                        try {
                            const mailResponse = await fetch('/api/auth/signup?message=welcome', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ email: submitData.email }),
                            });
                            mailSent = mailResponse.ok;
                        } catch {
                            mailSent = false;
                        }

                        alert(mailSent
                            ? "가입 성공! 이메일로 발송된 인증코드를 확인해주세요."
                            : "가입은 완료됐지만 인증 메일 전송에 실패했습니다. 인증 페이지에서 재전송해주세요.");

                        // 4. 페이지 이동 (이메일을 쿼리 파라미터로 전달하여 useBaseActions가 useEffect에서 이메일을 자동으로 가져옴
                        const userEmail = submitData.email;
                        router.push(`/view/VERIFY_CODE_PAGE?email=${encodeURIComponent(userEmail)}`);
                    }
                } catch (error: any) {
                    // 에러 발생 시 handleError 호출 후 함수 종료 (이후 코드 실행 방지)
                    handleError(error, 'REGISTER_SUBMIT', '회원가입에 실패했습니다');
                    return; // 명시적으로 함수 종료
                }
                break;

            case "CHECK_USER_ID":
                try {
                    const userId = String(currentFormData.userId ?? '').trim();
                    if (!/^[A-Za-z0-9_]{4,20}$/.test(userId)) {
                        alert('아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요.');
                        return;
                    }
                    const res = await axios.get(actionUrl || '/api/auth/check-user-id', { params: { userId } });
                    const available = Boolean(res.data?.available);
                    base.setFormData((prev: any) => ({
                        ...prev,
                        userId,
                        _userIdChecked: available,
                        _checkedUserId: available ? userId : '',
                    }));
                    alert(available ? '사용 가능한 아이디입니다.' : '이미 사용 중인 아이디입니다.');
                } catch (error: any) {
                    const message = extractErrorMessage(error, '아이디 중복 확인에 실패했습니다.');
                    alert(message);
                }
                break;

            case "VERIFY_CODE":
                try {
                    const searchParams = new URLSearchParams(window.location.search);
                    const urlEmail = searchParams.get('email');
                    const urlCode = searchParams.get('code');
                    const currentData = base.formDataRef.current;
                    // console.log('currentData',currentData);

                    // [수정] 1. URL 파라미터가 있다면 무조건 그것을 사용 (가장 확실한 데이터)
                    // [수정] 2. currentData 조회 시 component_id(reg_code)와 ref_data_id(code)를 모두 체크
                    const finalEmail = urlEmail || currentData.reg_email || currentData.email;
                    const finalCode = urlCode || currentData.reg_code || currentData.code;
                    // console.log("최종 전송 데이터:", { finalEmail, finalCode });
                    // console.log("currentData:", currentData);
                    // 필수값 체크
                    if (!finalEmail) {
                        alert("이메일 정보가 없습니다. 다시 시도해주세요.");
                        return;
                    }
                    if (!finalCode) {
                        alert("인증 번호를 입력해주세요.");
                        return;
                    }

                    // 2. API 호출: 서버 DTO 구조에 맞춰서 전송
                    const res = await axios.post('/api/auth/verify-code', {
                        email: finalEmail,
                        code: finalCode
                    });

                    if (res.status === 200) {
                        alert("인증을 성공했습니다..");
                        router.push("/view/LOGIN_PAGE");
                    }
                } catch (error: any) {
                    alert(error.response?.data || "인증에 실패했습니다.");
                }
                break;

            case "LOGOUT":
                await logout();
                router.push('/view/LOGIN_PAGE');
                break;

            case "SUBMIT_ADDITIONAL_INFO":
                try {
                    // RBAC: 카카오 로그인 후 추가 정보 입력 (2026-03-01 추가)
                    // console.log('[DEBUG] currentFormData:', currentFormData);
                    // console.log('[DEBUG] currentFormData keys:', Object.keys(currentFormData));

                    // ref_data_id에 맞춰 키 수정
                    const phone = currentFormData.phone;  // "phone" (소문자)
                    const roadAddress = currentFormData.road_address;
                    const detailAddress = currentFormData.detail_address;
                    const zipCode = currentFormData.zip_code;

                    // console.log('[DEBUG] 추출된 값:', { phone, roadAddress, detailAddress, zipCode });

                    // 필수 항목 검증
                    if (!phone || !roadAddress || !zipCode) {
                        alert('필수 항목을 입력해주세요');
                        return;
                    }

                    // 추가 정보 제출
                    const res = await axios.post('/api/auth/update-profile', {
                        phone,
                        roadAddress,
                        detailAddress,
                        zipCode
                    });

                    if (res.status === 200) {
                        // 사용자 정보 재조회 (role이 ROLE_USER로 업그레이드됨)
                        const userRes = await axios.get('/api/auth/me');
                        login(userRes.data); // AuthContext 상태 업데이트

                        alert('정보가 저장되었습니다');
                        router.push('/view/CONTENT_LIST');
                    }
                } catch (error: any) {
                    handleError(error, 'SUBMIT_ADDITIONAL_INFO', '추가 정보 저장에 실패했습니다');
                }
                break;

            case "KAKAO_LOGOUT":
                try {
                    await axios.post('/api/kakao/logout');
                } catch (err) {
                    // console.error("Kakao logout failed", err);
                } finally {
                    await logout(); //  우리 서버 세션 정리 및 상태 초기화
                    if (actionUrl) {
                        window.location.href = actionUrl;
                    } else {
                        router.push('/view/LOGIN_PAGE');
                    }
                }
                break;
            case "LINK":
            case "ROUTE":
                if (!actionUrl) {
                    // console.warn("이동할 URL이 없습니다.");
                    return;
                }
                // 외부 링크(http)인 경우와 내부 경로 구분
                if (actionUrl.startsWith('http')) {
                    window.location.href = actionUrl;
                } else {
                    router.push(actionUrl);
                    // 페이지 이동 후 필요시 데이터 갱신
                    router.refresh();
                }
                break;
            case "OPEN_POSTCODE":
                // 팝업 방식(window.daum.Postcode.open)은 카카오 도메인 변경 후 차단됨.
                // iframe 방식(DaumPostcodeEmbed)으로 교체: PostcodeModal이 이벤트를 수신해 모달을 표시한다.
                window.dispatchEvent(new CustomEvent('open-postcode-modal', {
                    detail: {
                        onComplete: (data: any) => {
                            base.handleChange('zipCode', data.zonecode);
                            base.handleChange('roadAddress', data.roadAddress);
                        }
                    }
                }));
                break;

            case "TOGGLE_PW":
                base.togglePassword(); // base에 정의된 로직 실행 [cite: 2026-02-17]
                break;

            case "SOS":
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    sendMessage('/pub/location/emergency', {
                        userSqno: user?.userSqno,
                        status: 'HELP',
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                });
                break;

            default:
                break;
        }
    }, [base, user, sendMessage, router]);

    return {
        ...base,
        handleAction,
        activeModal,
        closeModal
    };
};
