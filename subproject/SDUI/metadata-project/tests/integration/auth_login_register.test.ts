import api from '@/services/axios';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('로그인/회원가입 통합 테스트', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  // ── 로그인 ──

  describe('POST /api/auth/login', () => {
    test('성공: 올바른 이메일+비밀번호 → 200 + 토큰 반환', async () => {
      server.use(
        http.post('*/api/auth/login', async ({ request }) => {
          const body = await request.json() as Record<string, string>;
          if (body.user_email === 'user@test.com' && body.user_pw === 'Pass123!') {
            return HttpResponse.json({
              accessToken: 'at-token',
              refreshToken: 'rt-token',
              role: 'ROLE_USER',
            }, { status: 200 });
          }
          return new HttpResponse('아이디 또는 비밀번호가 일치하지 않습니다.', { status: 401 });
        }),
      );

      const res = await api.post('/api/auth/login', {
        user_email: 'user@test.com',
        user_pw: 'Pass123!',
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBe('at-token');
      expect(res.data.role).toBe('ROLE_USER');
    });

    test('실패: 잘못된 비밀번호 → 401', async () => {
      server.use(
        http.post('*/api/auth/login', () => {
          return new HttpResponse('아이디 또는 비밀번호가 일치하지 않습니다.', { status: 401 });
        }),
      );

      await expect(
        api.post('/api/auth/login', {
          user_email: 'user@test.com',
          user_pw: 'wrong',
        }),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    test('실패: 이메일 미인증 사용자 → 403', async () => {
      server.use(
        http.post('*/api/auth/login', () => {
          return new HttpResponse('이메일 인증이 완료되지 않았습니다.', { status: 403 });
        }),
      );

      await expect(
        api.post('/api/auth/login', {
          user_email: 'unverified@test.com',
          user_pw: 'Pass123!',
        }),
      ).rejects.toMatchObject({ response: { status: 403 } });
    });
  });

  // ── 회원가입 ──

  describe('POST /api/auth/register', () => {
    test('성공: 신규 사용자 가입 → 201', async () => {
      server.use(
        http.post('*/api/auth/register', async ({ request }) => {
          const body = await request.json() as Record<string, string>;
          if (body.email && body.password && body.zipCode && body.roadAddress) {
            return new HttpResponse('User registred successfully!', { status: 201 });
          }
          return new HttpResponse('입력값 오류', { status: 400 });
        }),
      );

      const res = await api.post('/api/auth/register', {
        userId: 'newuser',
        password: 'NewPass123!',
        email: 'newuser@example.com',
        phone: '010-1111-2222',
        zipCode: '54321',
        roadAddress: '부산시 해운대구',
      });

      expect(res.status).toBe(201);
    });

    test('실패: 이미 존재하는 이메일 → 409', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          return new HttpResponse('이미 존재하는 이메일입니다.', { status: 409 });
        }),
      );

      await expect(
        api.post('/api/auth/register', {
          userId: 'dup',
          password: 'Pass123!',
          email: 'existing@test.com',
          phone: '010-3333-4444',
          zipCode: '11111',
          roadAddress: '서울시',
        }),
      ).rejects.toMatchObject({ response: { status: 409 } });
    });

    test('실패: 주소 정보 누락 → 400', async () => {
      server.use(
        http.post('*/api/auth/register', () => {
          return new HttpResponse('주소 정보는 필수입니다.', { status: 400 });
        }),
      );

      await expect(
        api.post('/api/auth/register', {
          userId: 'noaddr',
          password: 'Pass123!',
          email: 'noaddr@test.com',
          phone: '010-0000-0000',
        }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  // ── 이메일 인증 코드 확인 ──

  describe('POST /api/auth/verify-code', () => {
    test('성공: 올바른 코드 → 200', async () => {
      server.use(
        http.post('*/api/auth/verify-code', async ({ request }) => {
          const body = await request.json() as Record<string, string>;
          if (body.email && body.code === '1234567') {
            return new HttpResponse('인증 성공!', { status: 200 });
          }
          return new HttpResponse('인증 실패!', { status: 400 });
        }),
      );

      const res = await api.post('/api/auth/verify-code', {
        email: 'user@test.com',
        code: '1234567',
      });

      expect(res.status).toBe(200);
    });

    test('실패: 잘못된 코드 → 400', async () => {
      server.use(
        http.post('*/api/auth/verify-code', () => {
          return new HttpResponse('인증 실패! 코드를 다시 확인해주세요.', { status: 400 });
        }),
      );

      await expect(
        api.post('/api/auth/verify-code', {
          email: 'user@test.com',
          code: '0000000',
        }),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  // ── /api/auth/me ──

  describe('GET /api/auth/me', () => {
    test('인증된 사용자 → 사용자 정보 반환', async () => {
      const res = await api.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.data.isLoggedIn).toBe(true);
      expect(res.data.role).toBe('ROLE_USER');
      expect(res.data.email).toBe('test@example.com');
    });

    test('미인증 사용자 → isLoggedIn=false', async () => {
      server.use(
        http.get('*/api/auth/me', () => {
          return HttpResponse.json({
            isLoggedIn: false,
            role: 'GUEST',
          }, { status: 200 });
        }),
      );

      const res = await api.get('/api/auth/me');

      expect(res.data.isLoggedIn).toBe(false);
      expect(res.data.role).toBe('GUEST');
    });
  });

  // ── 로그아웃 ──

  describe('POST /api/auth/logout', () => {
    test('성공 → 200', async () => {
      const res = await api.post('/api/auth/logout');

      expect(res.status).toBe(200);
    });
  });

  // ── 회원가입 → 인증 → 로그인 플로우 ──

  describe('E2E 플로우: 회원가입 → 이메일 인증 → 로그인', () => {
    test('전체 플로우 성공', async () => {
      const testEmail = 'flow@test.com';

      // 1. 회원가입
      server.use(
        http.post('*/api/auth/register', () => {
          return new HttpResponse('User registred successfully!', { status: 201 });
        }),
      );

      const registerRes = await api.post('/api/auth/register', {
        userId: 'flowuser',
        password: 'FlowPass123!',
        email: testEmail,
        phone: '010-9999-0000',
        zipCode: '12345',
        roadAddress: '서울시 강남구',
      });
      expect(registerRes.status).toBe(201);

      // 2. 인증 코드 전송
      server.use(
        http.post('*/api/auth/signup', () => {
          return HttpResponse.json({
            message: '인증 코드가 이메일로 전송되었습니다.',
            email: testEmail,
          }, { status: 200 });
        }),
      );

      const signupRes = await api.post(`/api/auth/signup?message=welcome`, {
        email: testEmail,
      });
      expect(signupRes.status).toBe(200);

      // 3. 인증 코드 확인
      server.use(
        http.post('*/api/auth/verify-code', () => {
          return new HttpResponse('인증 성공!', { status: 200 });
        }),
      );

      const verifyRes = await api.post('/api/auth/verify-code', {
        email: testEmail,
        code: '1234567',
      });
      expect(verifyRes.status).toBe(200);

      // 4. 로그인
      server.use(
        http.post('*/api/auth/login', () => {
          return HttpResponse.json({
            accessToken: 'flow-access-token',
            refreshToken: 'flow-refresh-token',
            role: 'ROLE_USER',
          }, { status: 200 });
        }),
      );

      const loginRes = await api.post('/api/auth/login', {
        user_email: testEmail,
        user_pw: 'FlowPass123!',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.data.accessToken).toBe('flow-access-token');
    });
  });
});
