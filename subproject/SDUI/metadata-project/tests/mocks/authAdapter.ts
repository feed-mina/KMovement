import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

export type AuthAdapterState = { guest?: boolean; refreshFails?: boolean; executeCalls?: number };

function response(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data };
}

function failure(config: InternalAxiosRequestConfig, status: number, data: unknown): never {
  const res = response(config, status, data);
  throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, undefined, res);
}

export function createAuthAdapter(state: AuthAdapterState = {}): AxiosAdapter {
  return async (rawConfig) => {
    const config = rawConfig as InternalAxiosRequestConfig;
    const url = config.url || '';
    const method = (config.method || 'get').toLowerCase();
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
    if (url.includes('/api/execute/')) {
      state.executeCalls = (state.executeCalls || 0) + 1;
      if (state.executeCalls === 1) return failure(config, 401, null);
      return response(config, 200, { data: [] });
    }
    if (url === '/api/auth/refresh') {
      if (state.refreshFails) return failure(config, 401, null);
      return response(config, 200, { data: { refreshed: true } });
    }
    if (url === '/api/auth/login' && method === 'post') {
      if (body.user_pw === 'wrong') return failure(config, 401, 'invalid credentials');
      if (body.user_email === 'unverified@test.com') return failure(config, 403, 'email verification required');
      const flow = body.user_email === 'flow@test.com';
      return response(config, 200, { accessToken: flow ? 'flow-access-token' : 'at-token', refreshToken: 'rt-token', role: 'ROLE_USER', data: { accessToken: 'mock-access-token', email: body.email || 'test@example.com' } });
    }
    if (url === '/api/auth/register' && method === 'post') {
      if (body.email === 'existing@test.com') return failure(config, 409, 'duplicate email');
      if (!body.roadAddress) return failure(config, 400, 'address required');
      return response(config, 201, 'User registered successfully');
    }
    if (url.startsWith('/api/auth/signup')) return response(config, 200, { message: 'sent' });
    if (url === '/api/auth/verify-code') return body.code === '0000000' ? failure(config, 400, 'invalid code') : response(config, 200, 'verified');
    if (url === '/api/auth/me') return response(config, 200, state.guest ? { isLoggedIn: false, role: 'GUEST' } : { userId: 'testuser', userSqno: 1, email: 'test@example.com', role: 'ROLE_USER', isLoggedIn: true });
    if (url === '/api/auth/logout') return response(config, 200, { message: 'Logged out successfully' });
    return response(config, 404, null);
  };
}
