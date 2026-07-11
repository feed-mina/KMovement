import axios, {
  AxiosAdapter,
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import api from '@/services/axios';

function unauthorized(config: InternalAxiosRequestConfig): Promise<never> {
  const response: AxiosResponse = {
    data: null,
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  };
  return Promise.reject(
    new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response)
  );
}

describe('axios refresh handling', () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    jest.restoreAllMocks();
  });

  test('serializes concurrent 401 responses into one refresh request', async () => {
    const attempts = new Map<string, number>();
    let refreshCallCount = 0;

    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? '';
      if (url === '/api/auth/refresh') {
        refreshCallCount++;
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      }
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);

      if (count === 1) {
        return unauthorized(config);
      }

      return {
        data: { url },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }) as AxiosAdapter;

    const [first, second] = await Promise.all([
      api.get('/api/protected/first'),
      api.get('/api/protected/second'),
    ]);

    expect(first.data).toEqual({ url: '/api/protected/first' });
    expect(second.data).toEqual({ url: '/api/protected/second' });
    expect(refreshCallCount).toBe(1);
  });

  test('does not recursively retry when refresh fails', async () => {
    let refreshCallCount = 0;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/refresh') {
        refreshCallCount++;
        return Promise.reject(new AxiosError('Refresh failed', 'ERR_BAD_REQUEST', config));
      }
      return unauthorized(config);
    }) as AxiosAdapter;

    await expect(api.get('/api/protected')).rejects.toThrow('Refresh failed');
    expect(refreshCallCount).toBe(1);
  });
});
