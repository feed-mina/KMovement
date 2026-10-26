'use client';

import { useRouter } from 'next/navigation';
import { useContext, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { PHOTO_VIDEO_CONTEXT_KEY } from '@/lib/kride/personalLibrary';
export { PHOTO_VIDEO_CONTEXT_KEY } from '@/lib/kride/personalLibrary';


export default function PhotoVideoCourseLink({ data }: { data: unknown }) {
  const router = useRouter();
  const auth = useContext(AuthContext);
  const owner = auth?.isLoggedIn && !auth.isLoading ? String(auth.user?.userSqno ?? auth.user?.userId ?? '') : '';
  const [error, setError] = useState('');
  if (!owner) return null;
  if (process.env.NEXT_PUBLIC_PHOTO_VIDEO_ENABLED !== 'true') return null;
  if (!data || typeof data !== 'object') return null;
  const course = data as Record<string, unknown>;
  if (typeof course.courseContext !== 'string' || !Array.isArray(course.source_pois) || !course.source_pois.length) return null;
  const places = course.source_pois.filter((p: unknown): p is { id: string; name: string } => !!p && typeof p === 'object' &&
    typeof (p as Record<string, unknown>).id === 'string' && typeof (p as Record<string, unknown>).name === 'string')
    .slice(0, 24).map(p => ({ id: p.id, name: p.name }));
  if (!places.length) return null;
  return <span><button type="button" className="route-pill" onClick={() => {
    try {
      sessionStorage.setItem(PHOTO_VIDEO_CONTEXT_KEY, JSON.stringify({ owner, courseContext: course.courseContext, places }));
      router.push('/travel/video');
    } catch { setError('코스 연결 정보를 보관하지 못했습니다. 브라우저 저장 설정을 확인해주세요.'); }
  }}>이 코스의 여행 사진으로 영상 만들기</button>{error && <span role="alert">{error}</span>}</span>;
}
