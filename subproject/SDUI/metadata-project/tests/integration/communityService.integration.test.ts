import api from '@/services/axios';
import { communityService } from '@/services/communityService';

describe('communityService integration tests', () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('loads community post list through the shared axios instance', async () => {
    let capturedConfig: any;
    api.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: {
          status: 'success',
          data: {
            content: [
              {
                postId: 101,
                title: 'Seoul concert route',
                contentPreview: 'Best spots near the venue',
                authorSqno: 7,
                authorNickname: 'traveler',
                likeCount: 3,
                thumbnailUrl: null,
                createdAt: '2026-05-20T10:00:00',
              },
            ],
            totalElements: 1,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      };
    };

    const result = await communityService.getPostList(1, 5);

    expect(capturedConfig.url).toBe('/api/v1/community/posts');
    expect(capturedConfig.method).toBe('get');
    expect(capturedConfig.params).toEqual({ page: 1, size: 5 });
    expect(capturedConfig.withCredentials).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].postId).toBe(101);
    expect(result.content[0].title).toBe('Seoul concert route');
  });

  it('posts report payload and unwraps the ApiResponse envelope', async () => {
    let capturedConfig: any;
    api.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: {
          status: 'success',
          message: 'Report accepted',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      };
    };

    const result = await communityService.reportPost(
      101,
      'SPAM',
      'Repeated promotional content'
    );

    expect(capturedConfig.url).toBe('/api/v1/community/posts/101/reports');
    expect(capturedConfig.method).toBe('post');
    expect(JSON.parse(capturedConfig.data)).toEqual({
      reasonCode: 'SPAM',
      detailText: 'Repeated promotional content',
    });
    expect(capturedConfig.withCredentials).toBe(true);
    expect(result.status).toBe('success');
    expect(result.message).toBe('Report accepted');
  });
});
