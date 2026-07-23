import api from '@/services/axios';
import { communityModerationService } from '@/services/communityModerationService';

jest.mock('@/services/axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        patch: jest.fn(),
        create: jest.fn().mockReturnThis(),
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    },
}));

describe('communityModerationService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('게시글과 댓글 검수 대기열을 상태 및 페이지 기준으로 조회한다', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: { data: { content: [], totalElements: 0 } } });

        await communityModerationService.getPosts('PENDING', 0, 20);
        await communityModerationService.getComments('REJECTED', 1, 10);

        expect(api.get).toHaveBeenNthCalledWith(1, '/api/admin/community/posts', {
            params: { status: 'PENDING', page: 0, size: 20 },
        });
        expect(api.get).toHaveBeenNthCalledWith(2, '/api/admin/community/comments', {
            params: { status: 'REJECTED', page: 1, size: 10 },
        });
    });

    it('검수 메모와 함께 게시글 및 댓글의 공개 상태를 변경한다', async () => {
        (api.patch as jest.Mock).mockResolvedValue({ data: { data: {} } });

        await communityModerationService.moderatePost(11, 'APPROVED', '출처 확인 완료');
        await communityModerationService.moderateComment(23, 'REJECTED', '운영 원칙 위반');

        expect(api.patch).toHaveBeenNthCalledWith(1, '/api/admin/community/posts/11/moderation', {
            status: 'APPROVED',
            note: '출처 확인 완료',
        });
        expect(api.patch).toHaveBeenNthCalledWith(2, '/api/admin/community/comments/23/moderation', {
            status: 'REJECTED',
            note: '운영 원칙 위반',
        });
    });

    it('신고 대기열을 조회하고 허용된 다음 상태와 처리 메모를 전송한다', async () => {
        (api.get as jest.Mock).mockResolvedValue({ data: { data: { content: [] } } });
        (api.patch as jest.Mock).mockResolvedValue({ data: { data: {} } });

        await communityModerationService.getReports('OPEN');
        await communityModerationService.updateReportStatus(31, 'REVIEWING', '담당자 확인 시작');
        await communityModerationService.updateReportStatus(31, 'RESOLVED', '게시글 비공개 처리');

        expect(api.get).toHaveBeenCalledWith('/api/admin/community/reports', {
            params: { status: 'OPEN', page: 0, size: 20 },
        });
        expect(api.patch).toHaveBeenNthCalledWith(1, '/api/admin/community/reports/31/status', {
            status: 'REVIEWING',
            note: '담당자 확인 시작',
        });
        expect(api.patch).toHaveBeenNthCalledWith(2, '/api/admin/community/reports/31/status', {
            status: 'RESOLVED',
            note: '게시글 비공개 처리',
        });
    });
});
