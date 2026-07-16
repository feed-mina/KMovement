export interface TravelGuideContent {
    eyebrow: string;
    title: string;
    description: string;
    intro: string;
    highlights: Array<{ name: string; description: string; tip: string }>;
    checklist: string[];
    entryPoint: string;
}

export const kpopGuide: TravelGuideContent = {
    eyebrow: '서울 K-POP 여행 가이드',
    title: '서울 K-POP 성지, 하루 동선으로 가볍게',
    description: '홍대, 성수, 잠실 등 서울의 K-POP 여행 권역을 취향에 맞춰 묶어 보세요.',
    intro: '처음부터 장소를 많이 담기보다 같은 권역을 중심으로 공연, 팝업, 카페를 연결하면 이동 시간을 줄일 수 있습니다.',
    highlights: [
        { name: '홍대·연남 권역', description: '버스킹과 음반·굿즈 탐색을 함께 즐기기 좋은 지역입니다.', tip: '도보 이동을 중심으로 2~3곳을 묶어 보세요.' },
        { name: '성수 권역', description: '브랜드와 아티스트 팝업이 열리는 공간을 탐색하기 좋은 지역입니다.', tip: '방문 전 공식 채널에서 운영 일정을 확인하세요.' },
        { name: '잠실 권역', description: '대형 공연 관람 전후 식사와 산책 동선을 만들기 좋은 지역입니다.', tip: '공연 종료 시간과 막차 시간을 먼저 반영하세요.' },
    ],
    checklist: ['운영 시간과 휴무일 확인', '공식 예약·입장 안내 확인', '한 권역당 핵심 장소 2~3곳 선택', '공연 종료 후 귀가 동선 확보'],
    entryPoint: 'seo_seoul_kpop',
};

export const foodGuide: TravelGuideContent = {
    eyebrow: '서울 맛집 여행 가이드',
    title: '서울 먹거리 여행, 시장과 동네를 한 코스로',
    description: '시장 먹거리부터 카페까지 이동 부담이 적은 서울 미식 동선을 만들어 보세요.',
    intro: '메뉴만 고르기보다 시장, 산책, 카페처럼 경험을 섞고 식사 사이에 충분한 이동 시간을 두는 것이 좋습니다.',
    highlights: [
        { name: '광장시장 권역', description: '전통시장 먹거리와 도심 산책을 함께 구성하기 좋은 지역입니다.', tip: '혼잡 시간을 피해 여러 메뉴를 나눠 맛보세요.' },
        { name: '망원·합정 권역', description: '시장, 골목 식당, 카페를 도보로 연결하기 좋은 지역입니다.', tip: '시장 휴무와 재료 소진 시간을 확인하세요.' },
        { name: '을지로 권역', description: '오래된 골목과 새로운 식문화를 한 번에 경험하기 좋은 지역입니다.', tip: '저녁에는 대기 시간을 일정에 넉넉히 반영하세요.' },
    ],
    checklist: ['알레르기·식단 조건 확인', '브레이크타임 확인', '대기 시간을 포함해 일정 구성', '대중교통 막차와 귀가 경로 확인'],
    entryPoint: 'seo_seoul_food',
};
