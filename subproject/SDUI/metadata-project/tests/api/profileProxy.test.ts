import { POST } from '../../app/api/auth/update-profile/route';
import type { NextRequest } from 'next/server';
jest.mock('next/server', () => ({NextResponse: {json: (body: unknown, init?: {status?: number}) => ({body, status: init?.status ?? 200, headers: new Headers()})}}));
const originalEnv = {...process.env};
const fetchMock = jest.fn();
beforeAll(() => { if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', {configurable: true, value: () => new AbortController().signal}); });
const request = () => ({json: async () => ({phone: 'test-only'}), headers: new Headers({cookie: 'session=test-only'})}) as unknown as NextRequest;
beforeEach(() => {process.env = {...originalEnv, NODE_ENV: 'production'};delete process.env.AUTH_BACKEND_URL;delete process.env.BACKEND_URL;global.fetch = fetchMock;fetchMock.mockReset();});
afterAll(() => {process.env = originalEnv;});
it('uses the runtime internal auth server and forwards authentication cookies', async () => {
 process.env.AUTH_BACKEND_URL = 'http://spring:8080/';
 fetchMock.mockResolvedValue({status: 401, text: async () => '{"message":"login required"}', headers: new Headers()});
 const response = await POST(request());
 expect(response.status).toBe(401);
 expect(fetchMock).toHaveBeenCalledWith('http://spring:8080/api/auth/update-profile', expect.objectContaining({method:'POST',cache:'no-store',headers:expect.objectContaining({Cookie:'session=test-only'})}));
});
it('falls back to the server BACKEND_URL setting', async () => {
 process.env.BACKEND_URL = 'http://spring:8080';
 fetchMock.mockResolvedValue({status:200,text:async ()=>'{}',headers:new Headers()});
 expect((await POST(request())).status).toBe(200);
 expect(fetchMock.mock.calls[0][0]).toBe('http://spring:8080/api/auth/update-profile');
});
it('fails closed without a production backend instead of sending profile data to the old host', async () => {
 expect((await POST(request())).status).toBe(503);expect(fetchMock).not.toHaveBeenCalled();
});
