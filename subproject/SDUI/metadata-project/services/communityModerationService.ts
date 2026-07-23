import api from '@/services/axios';

export type ContentModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReportReviewStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

export interface ModerationQueuePage<T> {
    content: T[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

interface ModerationQueueBase {
    createdAt: string;
    dueAt: string | null;
    slaBreached: boolean;
    lastActorSqno: number | null;
}

export interface PostModerationItem extends ModerationQueueBase {
    postId: number;
    title: string;
    content: string;
    moderationStatus: ContentModerationStatus;
    authorSqno: number;
    authorNickname: string;
}

export interface CommentModerationItem extends ModerationQueueBase {
    commentId: number;
    postId: number;
    content: string;
    moderationStatus: ContentModerationStatus;
    authorSqno: number;
    authorNickname: string;
}

export interface ReportModerationItem extends ModerationQueueBase {
    reportId: number;
    postId: number;
    reasonCode: string;
    detailText: string | null;
    status: ReportReviewStatus;
    reporterSqno: number;
    reporterNickname: string;
    resolvedAt: string | null;
    resolutionNote: string | null;
}

const ADMIN_BASE = '/api/admin/community';

export const communityModerationService = {
    async getPosts(status: ContentModerationStatus, page = 0, size = 20) {
        const response = await api.get(`${ADMIN_BASE}/posts`, { params: { status, page, size } });
        return response.data.data as ModerationQueuePage<PostModerationItem>;
    },

    async moderatePost(postId: number, status: Exclude<ContentModerationStatus, 'PENDING'>, note: string) {
        const response = await api.patch(`${ADMIN_BASE}/posts/${postId}/moderation`, { status, note });
        return response.data.data as PostModerationItem;
    },

    async getComments(status: ContentModerationStatus, page = 0, size = 20) {
        const response = await api.get(`${ADMIN_BASE}/comments`, { params: { status, page, size } });
        return response.data.data as ModerationQueuePage<CommentModerationItem>;
    },

    async moderateComment(commentId: number, status: Exclude<ContentModerationStatus, 'PENDING'>, note: string) {
        const response = await api.patch(`${ADMIN_BASE}/comments/${commentId}/moderation`, { status, note });
        return response.data.data as CommentModerationItem;
    },

    async getReports(status: ReportReviewStatus, page = 0, size = 20) {
        const response = await api.get(`${ADMIN_BASE}/reports`, { params: { status, page, size } });
        return response.data.data as ModerationQueuePage<ReportModerationItem>;
    },

    async updateReportStatus(
        reportId: number,
        status: Exclude<ReportReviewStatus, 'OPEN'>,
        note: string,
    ) {
        const response = await api.patch(`${ADMIN_BASE}/reports/${reportId}/status`, { status, note });
        return response.data.data as ReportModerationItem;
    },
};
