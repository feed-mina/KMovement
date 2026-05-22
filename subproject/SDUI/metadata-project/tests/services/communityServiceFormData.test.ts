import { communityService } from '@/services/communityService';
import api from '@/services/axios';

jest.mock('@/services/axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const readJsonPart = async (formData: FormData, name: string) => {
  const value = formData.get(name);
  expect(value).toBeInstanceOf(Blob);
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(value as Blob);
  });
  return JSON.parse(text);
};

describe('communityService FormData unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createPost serializes the post JSON and attaches every image', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: {
        status: 'success',
        data: { postId: 10, title: 'K-pop route review' },
      },
    });

    const images = [
      new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
      new File(['second'], 'second.png', { type: 'image/png' }),
    ];

    const result = await communityService.createPost(
      { title: 'K-pop route review', content: 'Great trip' },
      images
    );

    const [url, formData, config] = (api.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/community/posts');
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    await expect(readJsonPart(formData, 'post')).resolves.toEqual({
      title: 'K-pop route review',
      content: 'Great trip',
    });
    expect(formData.getAll('images')).toHaveLength(2);
    expect(result.postId).toBe(10);
  });

  it('updatePost sends partial post data and new image files via PATCH', async () => {
    (api.patch as jest.Mock).mockResolvedValue({
      data: {
        status: 'success',
        data: { postId: 10, title: 'Updated title' },
      },
    });

    const image = new File(['updated'], 'updated.jpg', { type: 'image/jpeg' });

    const result = await communityService.updatePost(10, { title: 'Updated title' }, [image]);

    const [url, formData, config] = (api.patch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/community/posts/10');
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    await expect(readJsonPart(formData, 'post')).resolves.toEqual({
      title: 'Updated title',
    });
    expect(formData.get('images')).toBe(image);
    expect(result.title).toBe('Updated title');
  });
});
