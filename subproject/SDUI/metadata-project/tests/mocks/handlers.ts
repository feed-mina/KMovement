import { http, HttpResponse } from 'msw';

// 401 재시도 카운터
let apiCallCount = 0;

export const handlers = [
  // 인증 관련 핸들러
  http.get('http://localhost/api/auth/me', () => {
    return HttpResponse.json(
      {
        userId: 'testuser',
        userSqno: 1,
        email: 'test@example.com',
        role: 'ROLE_USER',
        isLoggedIn: true,
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }),

  http.post('http://localhost/api/auth/login', () => {
    const body = {
      data: {
        accessToken: 'mock-access-token',
        userId: 'testuser',
        email: 'test@example.com',
        role: 'ROLE_USER',
      },
    };
    return new HttpResponse(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }),

  http.post('http://localhost/api/auth/logout', () => {
    return HttpResponse.json(
      { message: 'Logged out successfully' },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }),

  // TC-S002: 401 → refresh → 재시도 성공 시나리오
  http.post('http://localhost/api/execute/:sqlKey', ({ params }) => {
    if (apiCallCount === 0) {
      apiCallCount++;
      return new HttpResponse(null, { status: 401 });
    }
    apiCallCount = 0;
    return HttpResponse.json(
      { data: [] },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }),

  // TC-S002: refresh 성공
  http.post('http://localhost/api/auth/refresh', () => {
    return HttpResponse.json(
      { data: { accessToken: 'new-access-token' } },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }),

  // TC-S003: refresh 실패 시나리오
  http.post('http://localhost/api/auth/refresh-fail', () => {
    return new HttpResponse(null, { status: 401 });
  }),

  // 화면 메타데이터 핸들러
  http.get('http://localhost/api/ui/:screenId', ({ params }) => {
    const { screenId } = params;
    return HttpResponse.json({
      data: [
        {
          component_id: 'test_component',
          component_type: 'TEXT',
          label_text: `Test Screen: ${screenId}`,
          parent_group_id: null,
          children: [],
        },
      ],
    });
  }),
];

export const resetApiCallCount = () => {
  apiCallCount = 0;
};
