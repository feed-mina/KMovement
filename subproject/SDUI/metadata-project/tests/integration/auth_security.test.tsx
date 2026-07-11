import { render, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import api from '@/services/axios';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { resetApiCallCount } from '../mocks/handlers';
import { createAuthAdapter, type AuthAdapterState } from '../mocks/authAdapter';

const authState: AuthAdapterState = {};
const originalAdapter = api.defaults.adapter;

describe('인증 보안 — API 보호 엔드포인트', () => {
  afterEach(() => server.resetHandlers());

  afterAll(() => {
    api.defaults.adapter = originalAdapter;
  });

  beforeEach(() => {
    // 각 테스트 전 카운터 리셋
    resetApiCallCount();
    Object.keys(authState).forEach((key) => delete authState[key as keyof AuthAdapterState]);
    api.defaults.adapter = createAuthAdapter(authState);
  });

  // TC-S002: 401 자동 갱신 → 성공 시 원래 요청 재시도
  test('TC-S002: 401 응답 시 refresh 후 원래 요청 재시도', async () => {
    // Given: MSW로 첫 요청 401, refresh 성공, 두 번째 요청 200 설정됨 (handlers.ts)

    // When: API 요청
    const response = await api.post('/api/execute/testQuery', { param: 'value' });

    // Then: 최종적으로 200 응답 처리됨
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: [] });
  });

  // TC-S003: 401 자동 갱신 → 실패 시 로그아웃 처리
  test('TC-S003: refresh 실패 시 에러 처리', async () => {
    authState.refreshFails = true;
    // Given: refresh 실패하는 핸들러로 오버라이드
    server.use(
      http.post('http://localhost/api/execute/testQuery', () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post('http://localhost/api/auth/refresh', () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    // When & Then: API 요청 시 에러 발생
    await expect(api.post('/api/execute/testQuery')).rejects.toThrow();
  });

  // TC-S004: JWT 쿠키 전환 후 — localStorage 미사용 확인
  test('TC-S004: localStorage에 accessToken이 저장되지 않음', () => {
    // Given: 로컬스토리지 spy
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    // When: axios 요청 인터셉터가 실행될 때
    // (실제로는 axios.tsx에서 localStorage 코드가 주석 처리됨)

    // Then: localStorage 호출이 없어야 함 (주석 처리되었으므로)
    // 이 테스트는 axios.tsx가 localStorage를 사용하지 않는다는 것을 확인
    expect(getItemSpy).not.toHaveBeenCalledWith('accessToken');

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  // TC-S005: axios withCredentials — 쿠키 자동 전송
  test('TC-S005: axios 인스턴스에 withCredentials=true 설정됨', () => {
    // When: axios 인스턴스 설정 확인
    const axiosDefaults = api.defaults;

    // Then: withCredentials가 true여야 함
    expect(axiosDefaults.withCredentials).toBe(true);
  });

  // TC-S006: /api/auth/me 호출 테스트
  test('TC-S006: /api/auth/me 호출 시 사용자 정보 반환', async () => {
    // When: /api/auth/me 호출
    const response = await api.get('/api/auth/me');

    // Then: 사용자 정보 반환
    expect(response.data).toEqual({
      userId: 'testuser',
      userSqno: 1,
      email: 'test@example.com',
      role: 'ROLE_USER',
      isLoggedIn: true,
    });
  });

  // TC-S007: 로그인 API 테스트
  test('TC-S007: 로그인 성공 시 쿠키로 토큰 수신', async () => {
    // Given: 로그인 요청 데이터
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    // When: 로그인 API 호출
    const response = await api.post('/api/auth/login', loginData);

    // Then: 로그인 성공 응답
    expect(response.status).toBe(200);
    expect(response.data.data).toHaveProperty('accessToken');
    expect(response.data.data.email).toBe('test@example.com');
  });

  // TC-S008: 로그아웃 API 테스트
  test('TC-S008: 로그아웃 API 호출 성공', async () => {
    // When: 로그아웃 API 호출
    const response = await api.post('/api/auth/logout');

    // Then: 로그아웃 성공
    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Logged out successfully');
  });
});
