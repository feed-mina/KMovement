import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommunityDiscussion from '@/components/community/CommunityDiscussion';
import { communityService } from '@/services/communityService';

jest.mock('@/services/communityService', () => ({
    communityService: {
        getComments: jest.fn(),
        createComment: jest.fn(),
        updateComment: jest.fn(),
        deleteComment: jest.fn(),
        reportPost: jest.fn(),
    },
}));

const approvedComment = {
    commentId: 7,
    postId: 1,
    authorSqno: 3,
    authorNickname: '여행자',
    content: '좋은 정보예요.',
    moderationStatus: 'APPROVED' as const,
    createdAt: '2026-07-23T09:00:00',
    updatedAt: '2026-07-23T09:00:00',
};

describe('CommunityDiscussion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (communityService.getComments as jest.Mock).mockResolvedValue([approvedComment]);
    });

    it('공개 댓글과 본인 댓글 수정·삭제 동작을 보여준다', async () => {
        render(
            <CommunityDiscussion postId={1} isLoggedIn currentUserSqno={3} onRequireLogin={jest.fn()} />,
        );

        expect(await screen.findByText('좋은 정보예요.')).toBeInTheDocument();
        expect(screen.getByText('공개된 댓글 1개')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
    });

    it('새 댓글이 검수 대기이면 접수 상태를 사용자에게 안내한다', async () => {
        (communityService.createComment as jest.Mock).mockResolvedValue({
            ...approvedComment,
            commentId: 8,
            content: '새 여행 팁입니다.',
            moderationStatus: 'PENDING',
        });
        render(
            <CommunityDiscussion postId={1} isLoggedIn currentUserSqno={3} onRequireLogin={jest.fn()} />,
        );
        await screen.findByText('좋은 정보예요.');

        fireEvent.change(screen.getByLabelText('댓글 작성'), { target: { value: '새 여행 팁입니다.' } });
        fireEvent.click(screen.getByRole('button', { name: '댓글 등록' }));

        await waitFor(() => expect(communityService.createComment).toHaveBeenCalledWith(1, '새 여행 팁입니다.'));
        expect(await screen.findByText('댓글을 접수했습니다. 운영 검수 후 공개됩니다.')).toBeInTheDocument();
        expect(screen.getByText('검수 대기')).toBeInTheDocument();
    });

    it('구조화된 신고 사유와 상세 내용을 전송한다', async () => {
        (communityService.reportPost as jest.Mock).mockResolvedValue({ status: 'success' });
        render(
            <CommunityDiscussion postId={1} isLoggedIn currentUserSqno={3} onRequireLogin={jest.fn()} />,
        );
        await screen.findByText('좋은 정보예요.');

        fireEvent.click(screen.getByRole('button', { name: '이 글 신고하기' }));
        fireEvent.change(screen.getByLabelText('신고 사유'), { target: { value: 'MISINFORMATION' } });
        fireEvent.change(screen.getByLabelText('자세한 내용 (선택)'), { target: { value: '장소 정보가 다릅니다.' } });
        fireEvent.click(screen.getByRole('button', { name: '신고 접수' }));

        await waitFor(() => expect(communityService.reportPost).toHaveBeenCalledWith(
            1,
            'MISINFORMATION',
            '장소 정보가 다릅니다.',
        ));
        expect(await screen.findByText('신고가 접수되었습니다. 운영팀이 확인합니다.')).toBeInTheDocument();
    });
});
