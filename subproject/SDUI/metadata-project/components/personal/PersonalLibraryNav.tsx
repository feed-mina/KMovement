'use client';
import Link from 'next/link';
import {savedLibraryHref, safePersonalReturn, videoLibraryHref} from '@/lib/kride/personalLibrary';

type Props = {active: 'profile' | 'saved' | 'videos'; savedHref?: string; videoEnabled?: boolean};
export default function PersonalLibraryNav({active, savedHref, videoEnabled = process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED === 'true'}: Props) {
    const back = savedHref ? safePersonalReturn(savedHref) : '/view/MY_PAGE';
    const saved = back.startsWith('/view/KPOP_SAVED_ITEMS') ? back : savedLibraryHref();
    return <nav className="personal-library-nav" aria-label="나의 보관함">
        <Link href="/view/MY_PAGE" aria-current={active === 'profile' ? 'page' : undefined}>마이페이지</Link>
        <Link href={saved} aria-current={active === 'saved' ? 'page' : undefined}>내 목록</Link>
        {videoEnabled && <Link href={videoLibraryHref({view: 'history', returnTo: back})} aria-current={active === 'videos' ? 'page' : undefined}>내 영상</Link>}
    </nav>;
}
