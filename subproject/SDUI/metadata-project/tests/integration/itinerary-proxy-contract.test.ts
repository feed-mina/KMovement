/** @jest-environment node */
import { POST } from '@/app/api/kride/recommend/itinerary/route';
import { buildItineraryRequest } from '@/lib/kride/itineraryRequest';

const saved = { ...process.env };
const originalFetch = global.fetch;
const body = buildItineraryRequest({ visitDate: '2026-10-26', duration: 'day', selectedRegions: [{name: '서울'}], budget: [30000, 200000], responseLocale: 'en', acknowledgeUnverifiedConditions: true });
const request = (value = body) => new Request('http://web/api/kride/recommend/itinerary', { method: 'POST', headers: {cookie: 'session=fixture'}, body: JSON.stringify(value) }) as any;
beforeEach(() => {
    process.env.FASTAPI_URL = 'http://cpu'; process.env.AUTH_BACKEND_URL = 'http://auth'; process.env.KRIDE_INTERNAL_TOKEN = 'fixture';
    global.fetch = jest.fn().mockResolvedValueOnce(Response.json({isLoggedIn: true, userSqno: 7}));
});
afterEach(() => { process.env = {...saved}; global.fetch = originalFetch; });

test('forwards builder output unchanged including consent, budget and locale', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(Response.json({status: 'ok'}));
    const result = await POST(request());
    expect(result.status).toBe(200);
    const [url, init] = (fetch as jest.Mock).mock.calls[1];
    expect(url).toBe('http://cpu/api/public/itinerary');
    expect(JSON.parse(init.body)).toEqual(body);
    expect(init.headers['X-Kride-User']).toBe('7');
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
});

test('does not change false consent to true', async () => {
    const problem = {detail: {code: 'consent_required'}};
    (fetch as jest.Mock).mockResolvedValueOnce(Response.json(problem, {status: 422}));
    const result = await POST(request({...body, acknowledgeUnverifiedConditions: false}));
    expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).acknowledgeUnverifiedConditions).toBe(false);
    expect(result.status).toBe(422);
    expect(await result.json()).toEqual(problem);
});

test.each([401, 403, 422, 429, 502, 503, 504])('preserves upstream status %i and structured detail', async status => {
    const problem = {detail: {code: 'unsupported_conditions'}};
    (fetch as jest.Mock).mockResolvedValueOnce(Response.json(problem, {status}));
    const result = await POST(request());
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual(problem);
});

test('expired login stops before generation server', async () => {
    (fetch as jest.Mock).mockReset().mockResolvedValueOnce(Response.json({isLoggedIn: false}));
    expect((await POST(request())).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(['AbortError', 'TimeoutError'])('%s is a 504, separate from connection failures', async name => {
    const error = new Error('fixture'); error.name = name;
    (fetch as jest.Mock).mockRejectedValueOnce(error);
    expect((await POST(request())).status).toBe(504);
});

test('non-JSON successful upstream is an upstream failure, not empty recommendations', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(new Response('<html>invalid response</html>'));
    expect((await POST(request())).status).toBe(502);
});
