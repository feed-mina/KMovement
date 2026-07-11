import axios, {
    AxiosError,
    AxiosInstance,
    InternalAxiosRequestConfig,
} from 'axios';

interface ErrorResponse {
    code?: string;
    message?: string;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
const REFRESH_ENDPOINT = '/api/auth/refresh';
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
    REFRESH_ENDPOINT,
    '/api/auth/login',
    '/api/auth/logout',
    '/api/kakao/login',
    '/api/kakao/callback',
];

const api: AxiosInstance = axios.create({
    baseURL: '',
    withCredentials: true,
    timeout: 15000,
    // MSW v2 intercepts fetch reliably in Jest/JSDOM. The XHR adapter can
    // leave libuv handles active after the suite and abort the Node process.
    adapter: isTestEnv ? 'fetch' : undefined,
});

let refreshRequest: Promise<void> | null = null;

export function refreshSession(): Promise<void> {
    if (!refreshRequest) {
        // Use the base axios client so a failed refresh cannot enter this interceptor again.
        refreshRequest = axios
            .post(REFRESH_ENDPOINT, {}, {
                withCredentials: true,
                timeout: 15000,
                adapter: isTestEnv ? 'fetch' : undefined,
            })
            .then(() => undefined)
            .finally(() => {
                refreshRequest = null;
            });
    }

    return refreshRequest;
}

function shouldSkipRefresh(url?: string): boolean {
    return AUTH_ENDPOINTS_WITHOUT_REFRESH.some((endpoint) => url?.includes(endpoint));
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ErrorResponse>) => {
        const originalRequest = error.config as RetryableRequestConfig | undefined;
        const { response } = error;
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

        if (
            response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !shouldSkipRefresh(originalRequest.url)
        ) {
            originalRequest._retry = true;

            try {
                await refreshSession();
                return api(originalRequest);
            } catch (refreshError) {
                if (!isTestEnv && currentPath !== '/view/LOGIN_PAGE') {
                    alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
                    window.location.href = '/view/LOGIN_PAGE';
                }
                return Promise.reject(refreshError);
            }
        }

        if (!isTestEnv && response?.data) {
            const { code, message } = response.data;

            switch (code) {
                case 'AUTH_001':
                    alert(message || '아이디 또는 비밀번호를 확인해 주세요.');
                    break;
                case 'AUTH_004':
                    if (window.confirm(message || '이메일 인증이 필요합니다. 인증 페이지로 이동할까요?')) {
                        window.location.href = '/verify-email';
                    }
                    break;
                case 'AUTH_002':
                case 'AUTH_003':
                    alert(message || '사용할 수 없는 계정입니다.');
                    window.location.href = '/support';
                    break;
                case 'SYS_001':
                    alert('서버 오류가 발생했습니다.');
                    break;
                default:
                    if (message) alert(message);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
