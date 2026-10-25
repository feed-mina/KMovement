/** @jest-environment node */
import { GET, POST } from '../../app/api/travel-video/[...path]/route';
import type { NextRequest } from 'next/server';

const original = { ...process.env };
const fetchMock = jest.fn();
const photo = '1b9f52ba-77c2-4aa9-a1f4-a7fa18529e82';
const context = (path: string[]) => ({ params: Promise.resolve({ path }) });
function request(method = 'GET', body?: string, extra: Record<string, string> = {}) {
  const value = new Request('https://kride.test/api/travel-video/jobs?page=2', {
    method, body, headers: { cookie: 'session=test', origin: 'https://kride.test', ...extra },
  });
  return Object.assign(value, { nextUrl: new URL(value.url) }) as unknown as NextRequest;
}
beforeEach(() => {
  process.env = { ...original, PHOTO_VIDEO_ENABLED: 'true', PHOTO_VIDEO_URL: 'http://private:8085',
    PHOTO_VIDEO_INTERNAL_KEY: 'test-key-'.repeat(8), BACKEND_URL: 'http://spring:8080', PHOTO_VIDEO_PUBLIC_ORIGIN: 'https://kride.test' };
  global.fetch = fetchMock; fetchMock.mockReset();
  delete process.env.AUTH_BACKEND_URL;
});
afterAll(() => { process.env = original; });

it('stays disabled without explicit enablement', async () => {
  delete process.env.PHOTO_VIDEO_ENABLED;
  expect((await POST(request('POST', '{}'), context(['jobs']))).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('rejects foreign write origins before any backend request', async () => {
  expect((await POST(request('POST', '{}', { origin: 'https://other.test' }), context(['jobs']))).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('does not trust browser-supplied identity', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: false, userSqno: 999 }));
  expect((await GET(request('GET', undefined, { 'X-Photo-Video-Owner': '999' }), context(['jobs']))).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('uses the verified owner and preserves private video range responses', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  fetchMock.mockResolvedValueOnce(new Response('1234', { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-3/100', 'Accept-Ranges': 'bytes' } }));
  const response = await GET(request('GET', undefined, { Range: 'bytes=0-3', 'X-Photo-Video-Owner': '999' }), context(['jobs', photo, 'video']));
  expect(response.status).toBe(206);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-range')).toBe('bytes 0-3/100');
  expect(fetchMock.mock.calls[1][1].headers['X-Photo-Video-Owner']).toBe('17');
  expect(fetchMock.mock.calls[1][1].headers.Range).toBe('bytes=0-3');
});
it('forwards a bounded history page and rejects oversized upload streams', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  fetchMock.mockResolvedValueOnce(Response.json({ items: [] }));
  await GET(request(), context(['jobs']));
  expect(fetchMock.mock.calls[1][0]).toBe('http://private:8085/jobs?page=2');
  fetchMock.mockReset().mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  expect((await POST(request('POST', 'x'.repeat(10 * 1024 * 1024 + 1)), context(['photos']))).status).toBe(413);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('resolves signed course context before submitting and ignores browser place claims', async () => {
  process.env.FASTAPI_URL = 'http://ai:8000'; process.env.KRIDE_INTERNAL_TOKEN = 'test-only';
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  fetchMock.mockResolvedValueOnce(Response.json({ itineraryId: 'verified', poiId: 'poi:17', placeName: 'Server Name' }));
  fetchMock.mockResolvedValueOnce(Response.json({ jobId: photo }, { status: 202 }));
  const body = { photoId: photo, requestId: photo, courseContext: 'signed', poiId: 'poi:17' };
  expect((await POST(request('POST', JSON.stringify(body)), context(['jobs']))).status).toBe(202);
  expect(fetchMock.mock.calls[1][0]).toBe('http://ai:8000/api/public/itinerary/video-context');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).trip.placeName).toBe('Server Name');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).courseContext).toBeUndefined();
});
it('does not create an unlinked job when the course is revoked', async () => {
  process.env.FASTAPI_URL = 'http://ai:8000'; process.env.KRIDE_INTERNAL_TOKEN = 'test-only';
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  fetchMock.mockResolvedValueOnce(Response.json({ detail: 'expired' }, { status: 409 }));
  expect((await POST(request('POST', JSON.stringify({ photoId: photo, requestId: photo, courseContext: 'signed', poiId: 'poi:17' })), context(['jobs']))).status).toBe(409);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('rejects a forged resolved trip sent directly by the browser', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ isLoggedIn: true, userSqno: 17 }));
  expect((await POST(request('POST', JSON.stringify({ photoId: photo, requestId: photo, trip: { placeName: 'Forged' } })), context(['jobs']))).status).toBe(422);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
