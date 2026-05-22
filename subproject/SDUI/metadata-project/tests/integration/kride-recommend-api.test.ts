jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body: unknown, init?: ResponseInit) => ({
      status: init?.status ?? 200,
      json: jest.fn().mockResolvedValue(body),
    })),
  },
}));

import { POST } from '@/app/api/kride/recommend/itinerary/route';

const createRequest = (body: unknown) => ({
  json: jest.fn().mockResolvedValue(body),
});

describe('POST /api/kride/recommend/itinerary', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('forwards the itinerary request to FastAPI and returns its JSON payload', async () => {
    const body = {
      artists: ['BTS'],
      regions: ['Seoul'],
      durationDays: 2,
    };
    const fastApiPayload = {
      itinerary: [{ day: 1, title: 'Seoul music route' }],
    };

    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify(fastApiPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await POST(createRequest(body) as any);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/recommend/itinerary',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    await expect(response.json()).resolves.toEqual(fastApiPayload);
  });

  it('preserves FastAPI error status and detail text', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('upstream unavailable', {
        status: 503,
      })
    );

    const response = await POST(createRequest({ artists: [] }) as any);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'FastAPI 503',
      detail: 'upstream unavailable',
    });
  });
});
