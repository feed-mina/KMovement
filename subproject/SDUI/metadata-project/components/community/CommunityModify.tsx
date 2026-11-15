'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { communityService, PostResponse } from '@/services/communityService';
import { LoadingState } from './communityShared';
import { CommunityForm } from './CommunityForm';

export function CommunityModify({ postId }: { postId: number }) {
    const router = useRouter();
    const { user } = useAuth();
    const [post, setPost] = useState<PostResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        communityService.getPostDetail(postId)
            .then((result) => {
                if (!mounted) return;
                if (user?.userSqno && result.authorSqno && user.userSqno !== result.authorSqno) {
                    alert('수정 권한이 없습니다.');
                    router.replace(`/view/COMMUNITY_DETAIL/${postId}`);
                    return;
                }
                setPost(result);
            })
            .catch(() => setError('수정할 글을 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
        return () => {
            mounted = false;
        };
    }, [postId, router, user?.userSqno]);

    if (loading) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="community-page">
                <div className="community-shell">
                    <div className="community-error">{error || '글을 찾을 수 없습니다.'}</div>
                    <button className="community-secondary-btn" type="button" onClick={() => router.push('/view/COMMUNITY_LIST')}>
                        목록으로
                    </button>
                </div>
            </div>
        );
    }

    return <CommunityForm mode="modify" initialPost={post} />;
}
