/**
 * 사진이 없는 장소 카드에 쓸 결정적 썸네일.
 *
 * 전국 성지 시드 9,017곳 중 first_image 가 있는 곳은 127곳뿐이라, 나머지는 모두
 * 같은 회색 상자로 렌더된다. 목록 전체가 회색 벽이 되면 카드끼리 구분이 안 되고
 * 화면이 고장난 것처럼 보인다. 장소마다 다른 색과 첫 글자를 주면 사진 없이도
 * 목록이 읽힌다.
 *
 * 같은 장소는 항상 같은 색이어야 하므로 이름 해시로 고른다 — 무작위가 아니다.
 */

/** 브랜드 레드와 부딪히지 않도록 채도를 낮춘 색조. */
const TONES = [
    { from: '#F4DADB', to: '#E4B7B9', ink: '#7C3B3F' },
    { from: '#F6E4CE', to: '#EBC79B', ink: '#7A5426' },
    { from: '#DEE7DC', to: '#BCCDB9', ink: '#3E5140' },
    { from: '#D9E3EF', to: '#B6C8DE', ink: '#35506E' },
    { from: '#E3DCEC', to: '#C6BAD8', ink: '#4C3F66' },
    { from: '#EFE0D6', to: '#DCC0AC', ink: '#6B4632' },
    { from: '#D6E7E5', to: '#B0CFCB', ink: '#2F5551' },
    { from: '#EEDCE4', to: '#D9B8C6', ink: '#6B3A4C' },
] as const;

export interface PlaceholderThumbnail {
    /** 카드에 크게 얹을 글자. 한글 한 글자 또는 영문 한 글자. */
    initial: string;
    background: string;
    ink: string;
}

export function placeholderThumbnail(seed: string): PlaceholderThumbnail {
    const trimmed = seed.trim();
    // 서러게이트 페어(이모지 등)를 반 글자로 자르지 않도록 코드포인트 단위로 자른다.
    const initial = [...trimmed][0] ?? '·';

    let hash = 0;
    for (let i = 0; i < trimmed.length; i += 1) {
        hash = (Math.imul(hash, 31) + trimmed.charCodeAt(i)) >>> 0;
    }
    const tone = TONES[hash % TONES.length];

    return {
        initial,
        background: `linear-gradient(135deg, ${tone.from} 0%, ${tone.to} 100%)`,
        ink: tone.ink,
    };
}
