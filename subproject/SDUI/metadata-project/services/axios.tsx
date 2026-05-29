import axios, { AxiosInstance } from 'axios';

// 서버 에러 응답 규격 정의
interface ErrorResponse {
    code: string;
    message: string;
    status: number;
}

//   Axios 인스턴스 생성
// baseURL을 빈 문자열로 설정 (상대 URL 그대로 사용)
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
const api: AxiosInstance = axios.create({
    baseURL: '',  // 빈 문자열: 상대 URL 그대로 전달
    withCredentials: true,
    timeout: 15000,
});

// 1. 요청 인터셉터: HttpOnly 쿠키로 토큰이 자동 전송됨 (withCredentials: true)
api.interceptors.request.use(
    (config) => {
        // [2026-03-01 보안 강화] localStorage → HttpOnly Cookie 전환
        // 쿠키가 withCredentials: true로 자동 전송되므로 Authorization 헤더 불필요
        // const token = typeof window !== "undefined" ? localStorage.getItem('accessToken') : null;
        // if (token) {
        //     config.headers['Authorization'] = `Bearer ${token}`;
        // }
        return config;
    },
    (error) => Promise.reject(error)
);


// 3. 응답 인터셉터: 에러 핸들링 및 토큰 재발급 로직 통합
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const {response} = error;
        const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

        if (response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // 토큰 재발급 시도 (백엔드가 새 accessToken을 Set-Cookie로 내려줌)
                // IMPORTANT: 글로벌 axios가 아닌 api 인스턴스 사용 (baseURL 설정 유지)
                await api.post('/api/auth/refresh', {}, { withCredentials: true });

                // [2026-03-01 보안 강화] localStorage 삭제 - 쿠키 자동 관리
                // 백엔드가 새 토큰을 HttpOnly 쿠키로 설정하므로 클라이언트 코드 불필요
                // localStorage.setItem('accessToken', newAccessToken);
                // originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                // 원래 실패했던 요청을 쿠키로 재시도
                return api(originalRequest);
            } catch (err) {
                // 재발급 실패 시 리다이렉트
                // [2026-03-01 보안 강화] localStorage 삭제 - 쿠키는 백엔드에서 만료 처리
                // localStorage.removeItem('accessToken');
                if (!isTestEnv && currentPath !== "/view/LOGIN_PAGE") {
                    alert("세션이 만료되었습니다. 다시 로그인해주세요.");
                    window.location.href = "/view/LOGIN_PAGE";
                }
            }
            return Promise.reject(error);
        }

        // 재발급 실패 후의 비즈니스 에러 처리 (테스트 환경에서는 스킵)
        if (!isTestEnv && response?.data) {
            const {code, message} = response.data;

            switch (code) {
                case 'AUTH_001': // 로그인 실패
                    alert(message || '아이디 또는 비밀번호를 확인해주세요.');
                    break;
                case 'AUTH_004': // 이메일 미인증
                    if (window.confirm(message || '이메일 인증이 필요합니다. 인증 페이지로 이동할까요?')) {
                        window.location.href = '/verify-email';
                    }
                    break;
                case 'AUTH_002': // 계정 비활성화
                case 'AUTH_003': // 탈퇴 계정
                    alert(message);
                    window.location.href = '/support';
                    break;
                case 'SYS_001':
                    alert('서버 오류가 발생했습니다.');
                    break;
                default:
                    // 명시되지 않은 에러는 서버 메시지 그대로 출력
                    if (message) alert(message);
            }
        }

        return Promise.reject(error);
    }
);

export default api;