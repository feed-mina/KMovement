import { communityService } from '@/services/communityService';
import api from '@/services/axios';

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        create: jest.fn().mockReturnThis(),
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    },
}));

describe('communityService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPostList', () => {
        it('페이지 파라미터로 게시글 목록을 조회해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: {
                        content: [
                            { postId: 1, title: '첫 번째 게시글', authorNickname: '테스터' },
                        ],
                        totalElements: 1,
                    },
                },
            };
            (api.get as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.getPostList(0, 10);

            expect(api.get).toHaveBeenCalledTimes(1);
            expect(api.get).toHaveBeenCalledWith('/api/v1/community/posts', {
                params: { page: 0, size: 10 },
            });
            expect(result.content).toHaveLength(1);
            expect(result.content[0].title).toBe('첫 번째 게시글');
        });
    });

    describe('getPostDetail', () => {
        it('게시글 상세 정보를 조회해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: {
                        postId: 1,
                        title: '테스트 게시글',
                        content: '내용',
                        authorNickname: '테스터',
                        images: [],
                    },
                },
            };
            (api.get as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.getPostDetail(1);

            expect(api.get).toHaveBeenCalledWith('/api/v1/community/posts/1');
            expect(result.postId).toBe(1);
            expect(result.title).toBe('테스트 게시글');
        });
    });

    describe('createPost', () => {
        it('FormData로 게시글을 생성해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: { postId: 1, title: '새 게시글' },
                },
            };
            (api.post as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.createPost({
                title: '새 게시글',
                content: '내용',
            });

            expect(api.post).toHaveBeenCalledTimes(1);
            const [url, formData, config] = (api.post as jest.Mock).mock.calls[0];
            expect(url).toBe('/api/v1/community/posts');
            expect(formData).toBeInstanceOf(FormData);
            expect(config.headers['Content-Type']).toBe('multipart/form-data');
            expect(result.postId).toBe(1);
        });
    });

    describe('deletePost', () => {
        it('게시글을 삭제해야 함', async () => {
            const mockData = {
                data: { status: 'success', message: '게시글이 삭제되었습니다.' },
            };
            (api.delete as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.deletePost(1);

            expect(api.delete).toHaveBeenCalledWith('/api/v1/community/posts/1');
            expect(result.status).toBe('success');
        });
    });

    describe('toggleLike', () => {
        it('좋아요를 토글해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: { liked: true, likeCount: 5 },
                },
            };
            (api.post as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.toggleLike(1);

            expect(api.post).toHaveBeenCalledWith('/api/v1/community/posts/1/likes');
            expect(result.liked).toBe(true);
            expect(result.likeCount).toBe(5);
        });
    });

    describe('getLikeStatus', () => {
        it('좋아요 상태를 조회해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: { liked: false, likeCount: 3 },
                },
            };
            (api.get as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.getLikeStatus(1);

            expect(api.get).toHaveBeenCalledWith('/api/v1/community/posts/1/likes/status');
            expect(result.liked).toBe(false);
        });
    });

    describe('reportPost', () => {
        it('게시글을 신고해야 함', async () => {
            const mockData = {
                data: { status: 'success', message: '신고가 접수되었습니다.' },
            };
            (api.post as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.reportPost(1, 'SPAM', '스팸 게시글입니다.');

            expect(api.post).toHaveBeenCalledWith('/api/v1/community/posts/1/reports', {
                reasonCode: 'SPAM',
                detailText: '스팸 게시글입니다.',
            });
            expect(result.status).toBe('success');
        });
    });

    describe('comments', () => {
        const comment = {
            commentId: 7,
            postId: 1,
            authorSqno: 3,
            authorNickname: '여행자',
            content: '좋은 정보예요.',
            moderationStatus: 'PENDING',
            createdAt: '2026-07-23T09:00:00',
            updatedAt: '2026-07-23T09:00:00',
        };

        it('공개 댓글 목록을 조회해야 함', async () => {
            (api.get as jest.Mock).mockResolvedValue({
                data: { data: { content: [comment], totalElements: 1 } },
            });

            const result = await communityService.getComments(1);

            expect(api.get).toHaveBeenCalledWith('/api/v1/community/posts/1/comments');
            expect(result).toEqual([comment]);
        });

        it('댓글을 작성하고 수정해야 함', async () => {
            (api.post as jest.Mock).mockResolvedValue({ data: { data: comment } });
            (api.patch as jest.Mock).mockResolvedValue({
                data: { data: { ...comment, content: '수정한 댓글입니다.' } },
            });

            await communityService.createComment(1, '좋은 정보예요.');
            const updated = await communityService.updateComment(1, 7, '수정한 댓글입니다.');

            expect(api.post).toHaveBeenCalledWith('/api/v1/community/posts/1/comments', {
                content: '좋은 정보예요.',
            });
            expect(api.patch).toHaveBeenCalledWith('/api/v1/community/posts/1/comments/7', {
                content: '수정한 댓글입니다.',
            });
            expect(updated.content).toBe('수정한 댓글입니다.');
        });

        it('댓글을 삭제해야 함', async () => {
            (api.delete as jest.Mock).mockResolvedValue({ data: { status: 'success' } });

            await communityService.deleteComment(1, 7);

            expect(api.delete).toHaveBeenCalledWith('/api/v1/community/posts/1/comments/7');
        });
    });

    describe('toggleFollow', () => {
        it('팔로우를 토글해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: { following: true, followerCount: 10 },
                },
            };
            (api.post as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.toggleFollow(2);

            expect(api.post).toHaveBeenCalledWith('/api/v1/community/users/2/follow');
            expect(result.following).toBe(true);
        });
    });

    describe('getFollowStatus', () => {
        it('팔로우 상태를 조회해야 함', async () => {
            const mockData = {
                data: {
                    status: 'success',
                    data: { following: true, followerCount: 10, followingCount: 5 },
                },
            };
            (api.get as jest.Mock).mockResolvedValue(mockData);

            const result = await communityService.getFollowStatus(2);

            expect(api.get).toHaveBeenCalledWith('/api/v1/community/users/2/follow/status');
            expect(result.following).toBe(true);
            expect(result.followerCount).toBe(10);
        });
    });
});
