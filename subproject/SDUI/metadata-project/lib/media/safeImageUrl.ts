/**
 * 외부 이미지 URL 정규화.
 * TourAPI·성지 DB가 내려주는 URL은 신뢰할 수 없으므로 http(s)만 통과시키고,
 * 혼합 콘텐츠 차단을 피하려고 http는 https로 올린다.
 * PoiImage(탐색 화면)와 SpotThumbnail(맛집 랜딩)이 같은 규칙을 쓰도록 한곳에 둔다.
 */
export function safeHttpUrl(value?: string, upgradeHttp = false): string | undefined {
    if (!value?.trim()) return undefined;
    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
        if (upgradeHttp && parsed.protocol === 'http:') parsed.protocol = 'https:';
        return parsed.toString();
    } catch {
        return undefined;
    }
}
