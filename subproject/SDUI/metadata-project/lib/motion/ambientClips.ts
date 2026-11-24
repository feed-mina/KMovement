// 미리 만든 AI 영상(Higgsfield seedance_2_5, 5초·무음, 2026-11-24 생성). 실제 인물·상표 없이 풍경만 담았다.
// 파일은 public/media/motion/ 에 있다.
export type AmbientClip = {src: string};

const clip = (name: string): AmbientClip => ({src: `/media/motion/${name}.mp4`});

export const HOME_HERO_CLIP = clip('home-hero');
export const COURSE_TRAILER_CLIP = clip('course-trailer');

const AREA_CLIPS: Record<string, AmbientClip> = {
    seoul: clip('area-seoul'),
    busan: clip('area-busan'),
    jeju: clip('area-jeju'),
    gangwon: clip('area-gangwon'),
};

/** 지역 머리 영상·인기 지역 미리보기. 영상이 없는 지역은 null(기존 파스텔 배경 유지). */
export function areaClip(slug: string): AmbientClip | null {
    return AREA_CLIPS[slug] ?? null;
}
