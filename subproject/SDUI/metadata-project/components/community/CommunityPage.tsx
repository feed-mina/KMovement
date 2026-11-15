'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { CommunityPageProps, getMode, LoadingState } from './communityShared';
import { CommunityList } from './CommunityList';
import { CommunityForm } from './CommunityForm';
import { CommunityDetail } from './CommunityDetail';
import { CommunityModify } from './CommunityModify';

export default function CommunityPage({ screenId, refId }: CommunityPageProps) {
    const router = useRouter();
    const { isLoggedIn, isLoading } = useAuth();
    const mode = getMode(screenId);
    const postId = refId === null ? Number.NaN : Number(refId);

    useEffect(() => {
        if (isLoading) return;
        if ((mode === 'write' || mode === 'modify') && !isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            router.replace('/view/LOGIN_PAGE');
        }
    }, [isLoading, isLoggedIn, mode, router]);

    if (isLoading) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if ((mode === 'write' || mode === 'modify') && !isLoggedIn) {
        return (
            <div className="community-page">
                <div className="community-shell"><LoadingState /></div>
            </div>
        );
    }

    if (mode === 'write') return <CommunityForm mode="write" />;
    if (mode === 'detail' && Number.isFinite(postId)) return <CommunityDetail postId={postId} />;
    if (mode === 'modify' && Number.isFinite(postId)) return <CommunityModify postId={postId} />;

    return <CommunityList />;
}
