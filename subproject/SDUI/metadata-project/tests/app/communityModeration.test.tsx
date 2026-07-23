import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CommunityModerationPage from '@/app/admin/community/page';
import { communityModerationService } from '@/services/communityModerationService';

const mockUseAuth = jest.fn();

jest.mock('@/context/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/communityModerationService', () => ({
    communityModerationService: {
        getPosts: jest.fn(),
        moderatePost: jest.fn(),
        getComments: jest.fn(),
        moderateComment: jest.fn(),
        getReports: jest.fn(),
        updateReportStatus: jest.fn(),
    },
}));

const emptyPage = { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 };

describe('CommunityModerationPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: { role: 'ROLE_ADMIN' }, isLoading: false });
        (communityModerationService.getPosts as jest.Mock).mockResolvedValue({
            ...emptyPage,
            content: [{
                postId: 11,
                title: '검수할 게시글',
                content: '확인이 필요한 내용',
                moderationStatus: 'PENDING',
                authorSqno: 4,
                authorNickname: '작성자',
                createdAt: '2026-07-23T09:00:00',
                dueAt: '2026-07-23T10:00:00',
                slaBreached: true,
                lastActorSqno: null,
            }],
        });
        (communityModerationService.getComments as jest.Mock).mockResolvedValue(emptyPage);
        (communityModerationService.getReports as jest.Mock).mockResolvedValue(emptyPage);
        (communityModerationService.moderatePost as jest.Mock).mockResolvedValue({});
    });

    it('관리자가 SLA와 담당자 정보를 보고 메모를 남겨 게시글을 승인한다', async () => {
        render(<CommunityModerationPage />);

        expect(await screen.findByText('검수할 게시글')).toBeInTheDocument();
        expect(screen.getByText('처리 기한 지남')).toBeInTheDocument();
        expect(screen.getByText('최근 담당자 미배정')).toBeInTheDocument();

        fireEvent.click(within(screen.getByRole('article')).getByRole('button', { name: '승인·공개' }));
        const saveButton = screen.getByRole('button', { name: '기록하고 상태 변경' });
        expect(saveButton).toBeDisabled();
        fireEvent.change(screen.getByLabelText('처리 메모'), { target: { value: '운영 원칙 확인 완료' } });
        fireEvent.click(saveButton);

        await waitFor(() => expect(communityModerationService.moderatePost).toHaveBeenCalledWith(
            11,
            'APPROVED',
            '운영 원칙 확인 완료',
        ));
    });

    it('비관리자에게 운영 정보를 노출하지 않는다', () => {
        mockUseAuth.mockReturnValue({ user: { role: 'ROLE_USER' }, isLoading: false });

        render(<CommunityModerationPage />);

        expect(screen.getByText('커뮤니티 운영 화면 접근 권한이 없습니다.')).toBeInTheDocument();
        expect(communityModerationService.getPosts).not.toHaveBeenCalled();
    });
});
