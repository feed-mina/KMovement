'use client';

import { PostImageDto, PostListResponse } from '@/services/communityService';

export const ANIM_POLL_BASE_MS = 3000;
export const ANIM_POLL_MAX_MS = 30000;
export const ANIM_POLL_MAX_FAILURES = 5;

export type CommunityPageProps = {
    screenId: string;
    refId: string | number | null;
};

export type CommunityMode = 'list' | 'write' | 'detail' | 'modify';

export const PAGE_SIZE = 5;

export function getMode(screenId: string): CommunityMode {
    if (screenId.includes('WRITE')) return 'write';
    if (screenId.includes('DETAIL')) return 'detail';
    if (screenId.includes('MODIFY')) return 'modify';
    return 'list';
}

export function formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function normalizePage(data: any): {
    posts: PostListResponse[];
    totalPages: number;
    totalElements: number;
} {
    const posts = Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
            ? data
            : [];
    const totalElements = data?.totalElements ?? data?.total_elements ?? posts.length;
    const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    return { posts, totalPages, totalElements };
}

export function imageKey(image: PostImageDto) {
    return image.storedName || image.storageUrl || String(image.postImageId);
}

export function animationRouteLabel(route?: string) {
    switch (route) {
        case 'animated_drawings_worker':
            return '스케치/캐릭터 애니메이션';
        case 'cogvideox_real':
            return 'CogVideoX 사진 영상';
        case '3d_photo_inpainting_real':
            return '3D 사진 영상';
        case '3d_photo_light':
            return '3D 사진 라이트';
        case 'tora_cogvideox_i2v':
            return 'Tora 경로 제어 영상';
        case 'batch_video':
            return '전체 이미지 배치 영상';
        default:
            return route || '';
    }
}

export function formatFailedImageIndexes(value?: string) {
    if (!value) return '';
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => `${Number(item) + 1}번째`).join(', ');
        }
    } catch {
        /* use the raw value below */
    }
    return value;
}

export function dataUrlToFile(dataUrl: string, filename: string) {
    const [header, encoded] = dataUrl.split(',');
    const mime = header.match(/data:(.*);base64/)?.[1] || 'image/png';
    const bytes = window.atob(encoded);
    const buffer = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
        buffer[index] = bytes.charCodeAt(index);
    }
    return new File([buffer], filename, { type: mime });
}

export function EmptyState({ message }: { message: string }) {
    return <div className="community-empty">{message}</div>;
}

export function LoadingState() {
    return <div className="community-loading">불러오는 중입니다.</div>;
}
