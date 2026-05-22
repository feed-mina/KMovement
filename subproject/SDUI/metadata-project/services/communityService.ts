import api from '@/services/axios';

const BASE = '/api/v1/community';

export interface PostCreateRequest {
    title: string;
    content: string;
}

export interface PostUpdateRequest {
    title?: string;
    content?: string;
    retainedImages?: string[];
}

export interface PostResponse {
    postId: number;
    title: string;
    content: string;
    authorSqno: number;
    authorNickname: string;
    likeCount: number;
    reportCount: number;
    createdAt: string;
    updatedAt: string;
    images: PostImageDto[];
}

export interface PostImageDto {
    postImageId: number;
    storageUrl: string;
    originalName: string;
    storedName: string;
    sortOrder: number;
}

export interface PostListResponse {
    postId: number;
    title: string;
    contentPreview: string;
    authorSqno: number;
    authorNickname: string;
    likeCount: number;
    thumbnailUrl: string | null;
    createdAt: string;
}

export interface LikeStatusResponse {
    liked: boolean;
    likeCount: number;
}

export const communityService = {
    async createPost(data: PostCreateRequest, images?: File[]) {
        const formData = new FormData();
        formData.append('post', new Blob([JSON.stringify(data)], { type: 'application/json' }));
        if (images) {
            images.forEach((img) => formData.append('images', img));
        }
        const res = await api.post(`${BASE}/posts`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.data as PostResponse;
    },

    async getPostList(page = 0, size = 10) {
        const res = await api.get(`${BASE}/posts`, { params: { page, size } });
        return res.data.data;
    },

    async getPostDetail(postId: number) {
        const res = await api.get(`${BASE}/posts/${postId}`);
        return res.data.data as PostResponse;
    },

    async updatePost(postId: number, data: PostUpdateRequest, newImages?: File[]) {
        const formData = new FormData();
        formData.append('post', new Blob([JSON.stringify(data)], { type: 'application/json' }));
        if (newImages) {
            newImages.forEach((img) => formData.append('images', img));
        }
        const res = await api.patch(`${BASE}/posts/${postId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.data as PostResponse;
    },

    async deletePost(postId: number) {
        const res = await api.delete(`${BASE}/posts/${postId}`);
        return res.data;
    },

    async toggleLike(postId: number) {
        const res = await api.post(`${BASE}/posts/${postId}/likes`);
        return res.data.data as LikeStatusResponse;
    },

    async getLikeStatus(postId: number) {
        const res = await api.get(`${BASE}/posts/${postId}/likes/status`);
        return res.data.data as LikeStatusResponse;
    },

    async reportPost(postId: number, reasonCode: string, detailText?: string) {
        const res = await api.post(`${BASE}/posts/${postId}/reports`, { reasonCode, detailText });
        return res.data;
    },

    async toggleFollow(userSqno: number) {
        const res = await api.post(`${BASE}/users/${userSqno}/follow`);
        return res.data.data;
    },

    async getFollowStatus(userSqno: number) {
        const res = await api.get(`${BASE}/users/${userSqno}/follow/status`);
        return res.data.data;
    },
};
