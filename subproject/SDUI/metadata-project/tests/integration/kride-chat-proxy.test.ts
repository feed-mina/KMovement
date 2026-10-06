/** @jest-environment node */
import { POST } from '@/app/api/kride/chat/stream/route';

describe('CPU chat proxy', () => {
  const originalFetch = global.fetch;
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.FASTAPI_URL = 'http://cpu'; process.env.AUTH_BACKEND_URL = 'http://auth';
    process.env.KRIDE_INTERNAL_TOKEN = 'fixture'; global.fetch = jest.fn();
  });
  afterEach(() => { global.fetch = originalFetch; process.env = { ...saved }; });
  const request = (signal = new AbortController().signal) => new Request('http://web/api/kride/chat/stream', {
    method: 'POST', headers: { cookie: 'session=fixture' },
    body: JSON.stringify({ message: 'hi', userSqno: 999 }), signal,
  }) as any;
  const user = () => Response.json({ isLoggedIn: true, userSqno: 7 });

  it('uses only authenticated identity and forwards frames without buffering', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(user()).mockResolvedValueOnce(
      new Response('data: {"content":"hi"}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }));
    const response = await POST(request());
    expect(await response.text()).toContain('data: [DONE]');
    expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://cpu/api/public/chat/stream', expect.objectContaining({
      headers: { 'Content-Type': 'application/json', 'X-Kride-Token': 'fixture', 'X-Kride-User': '7' },
      body: JSON.stringify({ message: 'hi' }),
    }));
  });
  it('accepts the configured HTTPS origin behind an HTTP reverse proxy', async () => {
    process.env.KRIDE_SITE_ORIGIN='https://site.test';
    (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({isLoggedIn:false}));
    const req=new Request('http://internal/api/kride/chat/stream',{method:'POST',headers:{origin:'https://site.test'},body:JSON.stringify({message:'hi'})}) as any;
    expect((await POST(req)).status).toBe(401);
    const foreign=new Request('http://internal/api/kride/chat/stream',{method:'POST',headers:{origin:'https://foreign.test'},body:JSON.stringify({message:'hi'})}) as any;
    expect((await POST(foreign)).status).toBe(403);
  });
  it('blocks guests before CPU requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(Response.json({ isLoggedIn: false }));
    expect((await POST(request())).status).toBe(401); expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps the upstream quota status and conceals private error text', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(user()).mockResolvedValueOnce(new Response('private details', { status: 429 }));
    const result = await POST(request()); expect(result.status).toBe(429);
    expect(await result.text()).not.toContain('private details');
  });
  it('propagates cancellation to the upstream request and reader', async () => {
    const cancel = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce(user()).mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel }), { headers: { 'content-type': 'text/event-stream' } }));
    const result = await POST(request());
    const reader = result.body!.getReader(); await reader.cancel();
    expect((global.fetch as jest.Mock).mock.calls[1][1].signal.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
