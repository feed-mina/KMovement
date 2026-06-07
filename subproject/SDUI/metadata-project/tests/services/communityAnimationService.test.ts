import { communityService } from '@/services/communityService';
import api from '@/services/axios';

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
    },
}));

describe('community animation requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.post as jest.Mock).mockResolvedValue({
            data: { data: { jobId: 1, status: 'QUEUED' } },
        });
    });

    it('submits a post image ID instead of base64 image data', async () => {
        await communityService.submitAnimation(7, 42, 'cogvideox_real');

        expect(api.post).toHaveBeenCalledWith(
            '/api/v1/community/posts/7/animate',
            {
                postImageId: 42,
                route: 'cogvideox_real',
            },
        );
        expect(JSON.stringify((api.post as jest.Mock).mock.calls[0][1]))
            .not.toContain('base64');
    });

    it('submits batch image IDs with the standardized field names', async () => {
        await communityService.submitBatchAnimation(
            7,
            [
                {
                    postImageId: 42,
                    ttsText: 'first scene',
                    imageType: 'photo',
                },
                {
                    postImageId: 43,
                    ttsText: 'second scene',
                    imageType: 'sketch',
                },
            ],
            'bright_travel',
            'cogvideox_real',
            'calm travel music',
            15,
        );

        expect(api.post).toHaveBeenCalledWith(
            '/api/v1/community/posts/7/animate/batch',
            {
                images: [
                    {
                        postImageId: 42,
                        ttsText: 'first scene',
                        imageType: 'photo',
                    },
                    {
                        postImageId: 43,
                        ttsText: 'second scene',
                        imageType: 'sketch',
                    },
                ],
                bgmKey: 'bright_travel',
                photoRoute: 'cogvideox_real',
                bgmDescription: 'calm travel music',
                bgmDuration: 15,
            },
        );
        expect(JSON.stringify((api.post as jest.Mock).mock.calls[0][1]))
            .not.toContain('base64');
    });
});
