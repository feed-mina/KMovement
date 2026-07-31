/** 지역 대표 맛집 카드. TourAPI 음식점(contentTypeId=39) 연동 전까지 정적 큐레이션으로 채운다. */
export interface FoodSpot {
    name: string;
    district: string;
    category: string;
    reason: string;
}

/** 성지 카드. 성지 DB 연동이 비었을 때 쓰는 정적 큐레이션 — 맛집·K-POP 공용. */
export interface HolySpot {
    name: string;
    district: string;
    content: string;
    note: string;
}

/** @deprecated HolySpot 을 쓸 것. 맛집 전용이던 시절의 이름을 호환용으로 남긴다. */
export type FoodHolySpot = HolySpot;

export interface FoodAreaGuide {
    /** URL 세그먼트 — /travel/food/{slug} */
    slug: string;
    /** TourAPI 시·도 코드. TourExploreScreen의 NATIONWIDE_AREAS와 같은 체계다. */
    areaCode: string;
    name: string;
    fullName: string;
    tagline: string;
    description: string;
    intro: string;
    districts: string[];
    highlights: Array<{ name: string; description: string; tip: string }>;
    signatureSpots: FoodSpot[];
    holySpots: FoodHolySpot[];
    /** 내부 링크용 인접 시·도 slug. */
    neighbors: string[];
}

export const foodChecklist: string[] = [
    '영업시간과 휴무일 확인 (전통시장은 격주 휴무가 잦습니다)',
    '브레이크타임과 재료 소진 시간 확인',
    '대기 시간을 포함해 한 끼당 90분으로 계획',
    '알레르기·식단 조건 미리 확인',
    '대중교통 막차와 귀가 경로 확보',
];

export const foodHub = {
    eyebrow: '전국 맛집 여행 가이드',
    title: '전국 맛집, 시·도부터 고르고 구·군으로 좁히기',
    description: '17개 시·도의 권역별 먹거리 동선과 성지 맛집을 지역별로 정리했습니다.',
    intro: '지역을 먼저 고르면 이동 시간을 계산하기 쉬워집니다. 각 지역 페이지에서 권역별 동선, 대표 맛집, 작품·아티스트와 이어지는 성지 맛집을 한 번에 확인할 수 있습니다.',
    entryPoint: 'seo_food_hub',
};

export const foodAreas: FoodAreaGuide[] = [
    {
        slug: 'seoul',
        areaCode: '1',
        name: '서울',
        fullName: '서울특별시',
        tagline: '시장과 골목을 한 코스로',
        description: '광장시장, 망원, 을지로 등 서울 먹거리 권역을 시장과 카페까지 이어지는 여행 동선으로 계획해 보세요.',
        intro: '메뉴만 고르기보다 시장, 산책, 카페처럼 경험을 섞고 식사 사이에 충분한 이동 시간을 두는 것이 좋습니다.',
        districts: ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
        highlights: [
            { name: '광장시장·종로 권역', description: '전통시장 먹거리와 도심 산책을 함께 구성하기 좋은 지역입니다.', tip: '혼잡 시간을 피해 여러 메뉴를 나눠 맛보세요.' },
            { name: '망원·합정 권역', description: '시장, 골목 식당, 카페를 도보로 연결하기 좋은 지역입니다.', tip: '시장 휴무와 재료 소진 시간을 확인하세요.' },
            { name: '을지로 권역', description: '오래된 골목과 새로운 식문화를 한 번에 경험하기 좋은 지역입니다.', tip: '저녁에는 대기 시간을 일정에 넉넉히 반영하세요.' },
        ],
        signatureSpots: [
            { name: '광장시장 먹거리 골목', district: '중구', category: '전통시장', reason: '빈대떡·마약김밥·육회를 한 줄에서 나눠 먹기 좋습니다.' },
            { name: '망원시장', district: '마포구', category: '전통시장', reason: '포장 위주로 사서 한강공원까지 걸어가기 좋습니다.' },
            { name: '을지로 노포 골목', district: '중구', category: '노포', reason: '퇴근 시간 이후 대기가 길어 이른 저녁이 유리합니다.' },
            { name: '신당동 떡볶이 타운', district: '중구', category: '분식', reason: '즉석떡볶이 한 판을 2~3인이 나눠 먹는 구성입니다.' },
            { name: '연남동 카페 거리', district: '마포구', category: '카페', reason: '식사 사이 휴식 지점으로 넣기 좋은 밀집 구역입니다.' },
        ],
        holySpots: [
            { name: '광장시장 일대', district: '중구', content: '예능·다큐 촬영지', note: '국내외 음식 프로그램에 자주 등장한 시장 구간입니다.' },
            { name: '성수동 카페 거리', district: '성동구', content: '아이돌 팝업 상권', note: '아티스트 팝업이 열릴 때 카페 동선과 함께 묶입니다.' },
        ],
        neighbors: ['gyeonggi', 'incheon'],
    },
    {
        slug: 'incheon',
        areaCode: '2',
        name: '인천',
        fullName: '인천광역시',
        tagline: '개항장과 포구를 잇는 미식 동선',
        description: '차이나타운, 소래포구, 강화까지 인천 먹거리 권역을 하루 동선으로 계획해 보세요.',
        intro: '차이나타운의 근대 음식 문화와 서해 포구의 제철 해산물을 하루 안에 묶을 수 있습니다.',
        districts: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
        highlights: [
            { name: '차이나타운·개항장 권역', description: '근대 건축과 화교 음식 문화를 도보로 연결하는 구간입니다.', tip: '주말 오후는 혼잡하니 오전에 시작하세요.' },
            { name: '소래포구 권역', description: '제철 해산물을 사서 바로 맛보는 구성이 가능한 지역입니다.', tip: '물때와 조업 상황에 따라 품목이 달라집니다.' },
            { name: '강화 권역', description: '5일장과 향토 음식을 중심으로 반나절 코스를 만들기 좋습니다.', tip: '장이 서는 날짜를 먼저 확인하세요.' },
        ],
        signatureSpots: [
            { name: '차이나타운 짜장면 거리', district: '중구', category: '중식', reason: '역에서 바로 이어져 첫 끼로 배치하기 좋습니다.' },
            { name: '신포국제시장', district: '중구', category: '전통시장', reason: '닭강정과 분식을 포장해 개항장 산책과 묶습니다.' },
            { name: '소래포구 어시장', district: '남동구', category: '해산물', reason: '구입 후 초장집 이용까지 시간을 넉넉히 잡으세요.' },
            { name: '강화 풍물시장', district: '강화군', category: '향토음식', reason: '속노랑고구마·젓국갈비 등 지역 품목이 모입니다.' },
            { name: '송도 카페 거리', district: '연수구', category: '카페', reason: '저녁 전 휴식 지점으로 넣기 좋은 구간입니다.' },
        ],
        holySpots: [
            { name: '개항장 근대건축 거리', district: '중구', content: '시대극 촬영지', note: '붉은 벽돌 창고 구간이 배경으로 자주 쓰입니다.' },
            { name: '월미도 문화의거리', district: '중구', content: '예능 촬영지', note: '야경 구간이 방송에 반복해 등장했습니다.' },
        ],
        neighbors: ['seoul', 'gyeonggi'],
    },
    {
        slug: 'gyeonggi',
        areaCode: '31',
        name: '경기',
        fullName: '경기도',
        tagline: '수원에서 파주까지, 당일 미식 반경',
        description: '수원, 파주, 가평 등 서울에서 한 시간 안팎인 경기 먹거리 권역을 반나절 코스로 계획해 보세요.',
        intro: '서울에서 한 시간 안팎이면 닿는 도시들이라 반나절 단위로 끊어 계획하기 좋습니다.',
        districts: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '남양주시', '파주시', '가평군', '양평군'],
        highlights: [
            { name: '수원 화성 권역', description: '성곽 산책과 노포 식당을 한 동선으로 묶기 좋습니다.', tip: '왕갈비와 통닭은 저녁 대기가 깁니다.' },
            { name: '파주·헤이리 권역', description: '책과 전시 공간 사이에 카페를 배치하기 좋은 지역입니다.', tip: '월요일 휴관 시설이 많습니다.' },
            { name: '가평·양평 권역', description: '강변 드라이브와 식사를 함께 계획하는 구간입니다.', tip: '주말 오후 정체를 감안해 이른 출발이 좋습니다.' },
        ],
        signatureSpots: [
            { name: '수원 통닭거리', district: '수원시', category: '치킨', reason: '화성 야간 개장과 이어 붙이기 좋은 위치입니다.' },
            { name: '수원 왕갈비 상권', district: '수원시', category: '고기', reason: '1인 기준 양이 많아 인원수를 조절해 주문하세요.' },
            { name: '안산 다문화음식거리', district: '안산시', category: '세계음식', reason: '동남아·중앙아시아 식당이 한 블록에 모여 있습니다.' },
            { name: '헤이리 예술마을 카페', district: '파주시', category: '카페', reason: '전시 관람 사이 휴식 지점으로 적합합니다.' },
            { name: '두물머리 일대', district: '양평군', category: '향토음식', reason: '연잎밥·두부 요리 중심으로 점심 코스를 짭니다.' },
        ],
        holySpots: [
            { name: '가평 쁘띠프랑스', district: '가평군', content: '드라마 촬영지', note: '여러 드라마·예능이 촬영된 테마 마을입니다.' },
            { name: '파주 감악산 일대', district: '파주시', content: '예능 촬영지', note: '출렁다리 구간이 방송에 반복 등장했습니다.' },
        ],
        neighbors: ['seoul', 'incheon', 'gangwon'],
    },
    {
        slug: 'gangwon',
        areaCode: '32',
        name: '강원',
        fullName: '강원특별자치도',
        tagline: '동해안 시장과 산자락 향토음식',
        description: '강릉, 속초, 춘천 등 강원 먹거리 권역을 이동 시간까지 고려한 하루 코스로 계획해 보세요.',
        intro: '바다와 산이 가까워 이동 시간이 길어지기 쉽습니다. 하루에 한 권역만 잡는 편이 안전합니다.',
        districts: ['춘천시', '원주시', '강릉시', '속초시', '동해시', '삼척시', '평창군', '양양군', '고성군', '정선군'],
        highlights: [
            { name: '강릉·주문진 권역', description: '시장과 해변 카페를 한 줄로 연결할 수 있는 구간입니다.', tip: '초당순두부는 오전에 재료가 소진되기도 합니다.' },
            { name: '속초·양양 권역', description: '수산시장과 해변 산책을 묶기 좋은 지역입니다.', tip: '성수기 주말은 주차 시간을 별도로 잡으세요.' },
            { name: '춘천 권역', description: '역세권에 먹거리 골목이 모여 있어 뚜벅이 여행에 맞습니다.', tip: '닭갈비 후 막국수까지 한 번에 계획하세요.' },
        ],
        signatureSpots: [
            { name: '강릉 중앙시장', district: '강릉시', category: '전통시장', reason: '역에서 도보 거리라 도착 직후 첫 끼로 적합합니다.' },
            { name: '초당순두부마을', district: '강릉시', category: '향토음식', reason: '오전 방문이 대기와 재료 면에서 유리합니다.' },
            { name: '속초관광수산시장', district: '속초시', category: '해산물', reason: '닭강정 포장과 회 시식을 함께 구성합니다.' },
            { name: '춘천 닭갈비 골목', district: '춘천시', category: '고기', reason: '2인 이상 기준 주문이 대부분입니다.' },
            { name: '정선 아리랑시장', district: '정선군', category: '5일장', reason: '장날에만 열리는 좌판이 많아 날짜 확인이 필수입니다.' },
        ],
        holySpots: [
            { name: '주문진 방파제 일대', district: '강릉시', content: 'BTS 앨범 재킷 촬영지', note: '인근 카페·회센터와 묶어 반나절 동선이 됩니다.' },
            { name: '속초 아바이마을', district: '속초시', content: '드라마 촬영지', note: '갯배 구간이 드라마 배경으로 알려졌습니다.' },
        ],
        neighbors: ['gyeonggi', 'chungbuk', 'gyeongbuk'],
    },
    {
        slug: 'chungnam',
        areaCode: '34',
        name: '충남',
        fullName: '충청남도',
        tagline: '백제 도읍과 서해안 제철 밥상',
        description: '공주, 예산, 서해안까지 충남 먹거리 권역을 제철에 맞춰 계획해 보세요.',
        intro: '내륙의 향토 음식과 서해안 해산물이 계절에 따라 갈립니다. 방문 시기를 먼저 정하세요.',
        districts: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '당진시', '태안군', '홍성군', '예산군'],
        highlights: [
            { name: '공주·백제 권역', description: '유적 관람과 시장 먹거리를 함께 구성하기 좋습니다.', tip: '유적지는 오후 늦게 입장이 마감됩니다.' },
            { name: '서해안 권역', description: '제철 해산물 중심으로 한 끼를 크게 잡는 구간입니다.', tip: '대하·꽃게 등은 시기가 정해져 있습니다.' },
            { name: '예산·홍성 권역', description: '시장 골목에서 여러 가게를 옮겨 다니는 방식이 어울립니다.', tip: '현금 결제만 받는 좌판이 남아 있습니다.' },
        ],
        signatureSpots: [
            { name: '병천순대거리', district: '천안시', category: '향토음식', reason: '순대국밥 중심이라 이른 아침 식사로도 가능합니다.' },
            { name: '공주 산성시장', district: '공주시', category: '전통시장', reason: '공산성 관람과 도보로 이어집니다.' },
            { name: '예산시장', district: '예산군', category: '전통시장', reason: '여러 점포 음식을 한 자리에서 먹는 구조입니다.' },
            { name: '대천항 수산시장', district: '보령시', category: '해산물', reason: '구입 후 손질·조리 시간을 따로 잡으세요.' },
            { name: '서산 동부시장', district: '서산시', category: '전통시장', reason: '게국지·어리굴젓 등 지역 품목이 모입니다.' },
        ],
        holySpots: [
            { name: '공산성 일원', district: '공주시', content: '사극 촬영지', note: '성벽 구간이 시대극 배경으로 쓰였습니다.' },
            { name: '외암민속마을', district: '아산시', content: '사극 촬영지', note: '돌담길 구간이 촬영지로 알려져 있습니다.' },
        ],
        neighbors: ['sejong', 'chungbuk', 'jeonbuk'],
    },
    {
        slug: 'sejong',
        areaCode: '8',
        name: '세종',
        fullName: '세종특별자치시',
        tagline: '신도시 상권과 조치원 구도심',
        description: '조치원 구도심과 호수공원 신도시 상권으로 나뉘는 세종 먹거리 동선을 계획해 보세요.',
        intro: '행정도시 상권과 조치원 구도심의 결이 달라 두 곳을 나눠 계획하는 편이 좋습니다.',
        districts: ['조치원읍', '한솔동', '도담동', '아름동', '종촌동', '새롬동', '보람동', '소담동', '어진동'],
        highlights: [
            { name: '조치원 권역', description: '오래된 시장과 노포가 남아 있는 구도심 구간입니다.', tip: '평일 낮에 문을 여는 가게가 많습니다.' },
            { name: '호수공원 권역', description: '산책과 카페를 묶기 좋은 신도시 구간입니다.', tip: '저녁 시간대 상가 혼잡을 감안하세요.' },
            { name: '금강 수변 권역', description: '강변 카페와 식당이 이어지는 지역입니다.', tip: '도보 이동 거리가 길어 대중교통을 확인하세요.' },
        ],
        signatureSpots: [
            { name: '조치원전통시장', district: '조치원읍', category: '전통시장', reason: '복숭아 철에는 지역 농산물 좌판이 늘어납니다.' },
            { name: '세종전통시장', district: '한솔동', category: '전통시장', reason: '상설 구간과 장날 구간이 나뉘어 있습니다.' },
            { name: '도담동 상가 먹자골목', district: '도담동', category: '먹자골목', reason: '저녁 시간 회식 수요가 몰립니다.' },
            { name: '보람동 강변 카페', district: '보람동', category: '카페', reason: '일몰 시간대에 자리 확보가 어렵습니다.' },
            { name: '아름동 로컬 식당가', district: '아름동', category: '먹자골목', reason: '점심 특선 위주라 낮 방문이 유리합니다.' },
        ],
        holySpots: [
            { name: '세종호수공원 일대', district: '보람동', content: '예능 촬영지', note: '수변 무대 구간이 공연·방송에 쓰입니다.' },
            { name: '국립세종수목원 주변', district: '어진동', content: '화보 촬영지', note: '온실 구간이 촬영 배경으로 자주 등장합니다.' },
        ],
        neighbors: ['chungnam', 'chungbuk', 'daejeon'],
    },
    {
        slug: 'chungbuk',
        areaCode: '33',
        name: '충북',
        fullName: '충청북도',
        tagline: '내륙의 시장과 약초 밥상',
        description: '청주, 단양, 제천 등 충북 먹거리 권역을 청주 기점으로 묶어 계획해 보세요.',
        intro: '바다가 없는 대신 시장·약초·민물 요리가 지역 색을 만듭니다. 이동은 청주를 기점으로 잡으세요.',
        districts: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '단양군', '괴산군'],
        highlights: [
            { name: '청주 권역', description: '종합시장과 도심 골목을 함께 도는 구성이 어울립니다.', tip: '성안길은 저녁에 사람이 몰립니다.' },
            { name: '단양 권역', description: '시장 먹거리와 강변 산책을 이어 붙이기 좋습니다.', tip: '마늘 품목 중심이라 취향을 확인하세요.' },
            { name: '충주·제천 권역', description: '약초와 민물 요리를 중심으로 한 끼를 크게 잡습니다.', tip: '약령시는 요일별로 규모가 다릅니다.' },
        ],
        signatureSpots: [
            { name: '육거리종합시장', district: '청주시', category: '전통시장', reason: '규모가 커서 목표 품목을 정하고 들어가는 편이 낫습니다.' },
            { name: '성안길 먹자골목', district: '청주시', category: '먹자골목', reason: '도보 이동 거리가 짧아 두 끼를 붙이기 좋습니다.' },
            { name: '단양 구경시장', district: '단양군', category: '전통시장', reason: '마늘 요리 위주라 한 코스로 묶기 쉽습니다.' },
            { name: '충주 자유시장', district: '충주시', category: '전통시장', reason: '장날 좌판이 늘어 방문일을 맞추면 좋습니다.' },
            { name: '제천 약초시장', district: '제천시', category: '향토음식', reason: '약재 향이 강해 호불호를 미리 확인하세요.' },
        ],
        holySpots: [
            { name: '도담삼봉 일원', district: '단양군', content: '화보·MV 촬영지', note: '강 위 바위 구간이 영상 배경으로 쓰입니다.' },
            { name: '청남대', district: '청주시', content: '다큐 촬영지', note: '정원 구간이 방송에 반복 등장했습니다.' },
        ],
        neighbors: ['sejong', 'chungnam', 'gyeongbuk'],
    },
    {
        slug: 'daejeon',
        areaCode: '3',
        name: '대전',
        fullName: '대전광역시',
        tagline: '역세권에서 끝나는 미식 동선',
        description: '중앙시장, 은행동, 유성까지 대전 먹거리 권역을 역에서 가까운 순서로 계획해 보세요.',
        intro: '주요 상권이 역에서 가까워 짐을 들고도 움직일 수 있습니다. 환승 여행에 잘 맞습니다.',
        districts: ['동구', '중구', '서구', '유성구', '대덕구'],
        highlights: [
            { name: '중앙시장·중동 권역', description: '역에서 도보로 닿는 시장 구간입니다.', tip: '구역이 넓어 목표 골목을 정하고 들어가세요.' },
            { name: '은행동 권역', description: '빵집과 노포가 함께 모여 있는 도심 구간입니다.', tip: '주말 오후 대기 줄이 깁니다.' },
            { name: '유성 권역', description: '온천과 5일장을 함께 계획하기 좋은 지역입니다.', tip: '장날은 4·9로 끝나는 날입니다.' },
        ],
        signatureSpots: [
            { name: '대전 중앙시장', district: '동구', category: '전통시장', reason: '대전역에서 도보권이라 첫 일정으로 적합합니다.' },
            { name: '은행동 먹자골목', district: '중구', category: '먹자골목', reason: '빵집 대기 시간에 주변을 둘러보기 좋습니다.' },
            { name: '유성 5일장', district: '유성구', category: '5일장', reason: '장날에만 규모가 커집니다.' },
            { name: '도마큰시장', district: '서구', category: '전통시장', reason: '현지 수요 중심이라 가격대가 낮습니다.' },
            { name: '오정동 먹자상권', district: '대덕구', category: '먹자골목', reason: '저녁 회식 수요가 몰리는 시간대를 피하세요.' },
        ],
        holySpots: [
            { name: '대동하늘공원', district: '동구', content: 'MV·화보 촬영지', note: '야경 구간이 영상 배경으로 쓰입니다.' },
            { name: '성심당 일대 골목', district: '중구', content: '예능 촬영지', note: '방송 이후 대기 줄이 길어진 구간입니다.' },
        ],
        neighbors: ['sejong', 'chungnam', 'chungbuk'],
    },
    {
        slug: 'gyeongbuk',
        areaCode: '35',
        name: '경북',
        fullName: '경상북도',
        tagline: '천년 고도와 동해안 대게',
        description: '경주, 안동, 동해안까지 경북 먹거리 권역을 이동 거리에 맞춰 나눠 계획해 보세요.',
        intro: '경주 도심과 동해안은 차로 한 시간 이상 떨어져 있습니다. 하루에 둘 다 넣지 않는 편이 좋습니다.',
        districts: ['포항시', '경주시', '안동시', '구미시', '영주시', '문경시', '상주시', '영덕군', '울진군', '울릉군'],
        highlights: [
            { name: '경주 권역', description: '유적 산책과 카페 거리를 붙이기 좋은 구간입니다.', tip: '황리단길은 오후에 가장 붐빕니다.' },
            { name: '안동 권역', description: '종가 음식과 시장 먹거리를 함께 경험하는 지역입니다.', tip: '찜닭은 2인 기준 양이 많습니다.' },
            { name: '동해안 권역', description: '대게와 물회 중심으로 한 끼를 크게 구성합니다.', tip: '대게는 시세가 매일 달라집니다.' },
        ],
        signatureSpots: [
            { name: '황리단길', district: '경주시', category: '카페', reason: '식사보다 디저트·간식 위주로 배치하는 편이 낫습니다.' },
            { name: '경주 중앙시장', district: '경주시', category: '전통시장', reason: '야시장 운영일을 확인하면 저녁 코스가 됩니다.' },
            { name: '안동 구시장 찜닭골목', district: '안동시', category: '향토음식', reason: '가게마다 맵기 조절이 가능합니다.' },
            { name: '포항 죽도시장', district: '포항시', category: '해산물', reason: '물회와 회를 한 자리에서 비교하기 좋습니다.' },
            { name: '강구항 대게거리', district: '영덕군', category: '해산물', reason: '시세를 두세 곳 비교한 뒤 결정하세요.' },
        ],
        holySpots: [
            { name: '대릉원 돌담길', district: '경주시', content: '드라마 촬영지', note: '돌담 구간이 여러 작품에 등장했습니다.' },
            { name: '하회마을', district: '안동시', content: '사극 촬영지', note: '고택 구간이 시대극 배경으로 쓰였습니다.' },
        ],
        neighbors: ['daegu', 'gangwon', 'chungbuk'],
    },
    {
        slug: 'daegu',
        areaCode: '4',
        name: '대구',
        fullName: '대구광역시',
        tagline: '골목마다 한 가지 메뉴',
        description: '서문시장, 안지랑, 동성로 등 메뉴별로 형성된 대구 먹거리 골목을 동선으로 묶어 보세요.',
        intro: '메뉴별로 골목이 형성돼 있어 동선을 메뉴 기준으로 짜는 편이 효율적입니다.',
        districts: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군'],
        highlights: [
            { name: '서문시장 권역', description: '야시장과 도심 상권을 함께 도는 구간입니다.', tip: '야시장은 일몰 이후에 문을 엽니다.' },
            { name: '동성로 권역', description: '분식과 카페가 밀집한 도심 구간입니다.', tip: '주말 저녁은 이동 속도가 크게 느려집니다.' },
            { name: '수성못 권역', description: '산책과 식사를 함께 계획하기 좋은 지역입니다.', tip: '저녁 시간대 주차가 어렵습니다.' },
        ],
        signatureSpots: [
            { name: '서문시장 야시장', district: '중구', category: '야시장', reason: '소량씩 여러 가지를 맛보는 구성에 맞습니다.' },
            { name: '안지랑 곱창골목', district: '남구', category: '고기', reason: '가격이 표준화돼 있어 비교 부담이 적습니다.' },
            { name: '평화시장 닭똥집골목', district: '동구', category: '고기', reason: '튀김·양념·간장을 나눠 주문하는 방식입니다.' },
            { name: '김광석길 주변 상권', district: '중구', category: '카페', reason: '거리 관람과 카페를 자연스럽게 잇습니다.' },
            { name: '수성못 상권', district: '수성구', category: '먹자골목', reason: '산책 후 저녁 식사로 배치하기 좋습니다.' },
        ],
        holySpots: [
            { name: '김광석다시그리기길', district: '중구', content: '음악 성지', note: '벽화 거리와 인근 카페가 함께 묶입니다.' },
            { name: '앞산 전망대', district: '남구', content: '드라마 촬영지', note: '야경 구간이 배경으로 쓰였습니다.' },
        ],
        neighbors: ['gyeongbuk', 'gyeongnam'],
    },
    {
        slug: 'jeonbuk',
        areaCode: '37',
        name: '전북',
        fullName: '전북특별자치도',
        tagline: '한식의 기준이 되는 상차림',
        description: '전주, 군산, 남원까지 전북 먹거리 권역을 한 끼 중심으로 계획해 보세요.',
        intro: '한 끼 자체가 목적이 되는 지역입니다. 하루 두 끼 이상을 무리하게 넣지 마세요.',
        districts: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '고창군', '부안군', '순창군'],
        highlights: [
            { name: '전주 한옥마을 권역', description: '골목 식당과 간식을 이어 붙이기 좋은 구간입니다.', tip: '주말 오후는 대기가 길어집니다.' },
            { name: '군산 근대문화 권역', description: '근대 건축과 오래된 가게를 함께 도는 지역입니다.', tip: '월요일 휴무 시설이 많습니다.' },
            { name: '남원·순창 권역', description: '향토 음식 한 가지를 목적으로 잡는 구간입니다.', tip: '이동 시간이 길어 왕복 경로를 먼저 확인하세요.' },
        ],
        signatureSpots: [
            { name: '전주 남부시장', district: '전주시', category: '전통시장', reason: '야시장 운영일에는 저녁 코스로 바꿀 수 있습니다.' },
            { name: '객리단길', district: '전주시', category: '카페', reason: '식사 사이 휴식 지점으로 배치하기 좋습니다.' },
            { name: '군산 근대문화거리 상권', district: '군산시', category: '노포', reason: '오래된 빵집과 중식당이 한 구간에 모여 있습니다.' },
            { name: '남원 추어탕 거리', district: '남원시', category: '향토음식', reason: '점심 시간대에 회전이 빠릅니다.' },
            { name: '순창 고추장민속마을', district: '순창군', category: '향토음식', reason: '장 담그기 체험과 식사를 함께 구성합니다.' },
        ],
        holySpots: [
            { name: '초원사진관', district: '군산시', content: '영화 8월의 크리스마스', note: '촬영지 주변 노포와 묶어 반나절 동선이 됩니다.' },
            { name: '전주 한옥마을 일대', district: '전주시', content: '드라마·예능 촬영지', note: '한옥 골목 구간이 여러 작품에 등장했습니다.' },
        ],
        neighbors: ['chungnam', 'jeonnam', 'gyeongnam'],
    },
    {
        slug: 'jeonnam',
        areaCode: '38',
        name: '전남',
        fullName: '전라남도',
        tagline: '남해와 서해가 함께 차리는 밥상',
        description: '여수, 목포, 담양 등 전남 먹거리 권역을 한 권역씩 깊게 도는 코스로 계획해 보세요.',
        intro: '도시 간 거리가 멀어 하나의 권역을 골라 깊게 도는 편이 만족도가 높습니다.',
        districts: ['여수시', '순천시', '목포시', '나주시', '광양시', '담양군', '보성군', '구례군', '완도군', '해남군'],
        highlights: [
            { name: '여수 권역', description: '바다 전망과 포차 거리를 함께 계획하는 구간입니다.', tip: '성수기 주말은 숙소를 먼저 잡으세요.' },
            { name: '목포 권역', description: '수산시장과 근대 거리를 붙이기 좋은 지역입니다.', tip: '해산물은 계절에 따라 품목이 바뀝니다.' },
            { name: '담양·순천 권역', description: '정원·대숲 산책과 향토 음식을 잇는 구간입니다.', tip: '입장 마감 시간을 먼저 확인하세요.' },
        ],
        signatureSpots: [
            { name: '여수 교동시장', district: '여수시', category: '해산물', reason: '새벽 경매 이후 오전이 가장 활발합니다.' },
            { name: '목포 종합수산시장', district: '목포시', category: '해산물', reason: '세발낙지·민어 등 품목별 시기가 다릅니다.' },
            { name: '담양 국수거리', district: '담양군', category: '면요리', reason: '죽녹원 산책과 도보로 이어집니다.' },
            { name: '나주 곰탕거리', district: '나주시', category: '향토음식', reason: '아침 식사로도 가능한 몇 안 되는 선택지입니다.' },
            { name: '벌교 꼬막 상권', district: '보성군', category: '해산물', reason: '제철은 겨울이며 그 외 시기는 품목이 제한됩니다.' },
        ],
        holySpots: [
            { name: '여수 낭만포차거리', district: '여수시', content: '노래·예능 배경', note: '야간 해안 구간이 방송에 자주 등장합니다.' },
            { name: '순천만국가정원', district: '순천시', content: '드라마 촬영지', note: '정원 구간이 배경으로 쓰였습니다.' },
        ],
        neighbors: ['gwangju', 'jeonbuk', 'gyeongnam'],
    },
    {
        slug: 'gwangju',
        areaCode: '5',
        name: '광주',
        fullName: '광주광역시',
        tagline: '한 상 차림과 골목 카페',
        description: '양동시장, 동명동, 송정까지 광주 먹거리 권역을 도보 동선으로 계획해 보세요.',
        intro: '기본 상차림이 푸짐해 인원수보다 적게 주문하는 편이 좋습니다.',
        districts: ['동구', '서구', '남구', '북구', '광산구'],
        highlights: [
            { name: '양동시장 권역', description: '규모가 큰 시장에서 품목별로 나눠 도는 구간입니다.', tip: '닭전·어물전 등 구역이 나뉘어 있습니다.' },
            { name: '동명동 권역', description: '골목 카페와 식당이 섞여 있는 지역입니다.', tip: '저녁 시간대 주차가 어렵습니다.' },
            { name: '송정 권역', description: '역과 붙어 있어 환승 여행에 어울리는 구간입니다.', tip: '떡갈비는 포장 수요가 많습니다.' },
        ],
        signatureSpots: [
            { name: '양동시장', district: '서구', category: '전통시장', reason: '구역이 넓어 목표 품목을 정하고 들어가세요.' },
            { name: '1913송정역시장', district: '광산구', category: '전통시장', reason: '역 바로 앞이라 기차 시간과 맞추기 쉽습니다.' },
            { name: '동명동 카페거리', district: '동구', category: '카페', reason: '식사 사이 휴식 지점으로 적합합니다.' },
            { name: '무등산 보리밥 상권', district: '북구', category: '향토음식', reason: '등산 후 점심으로 배치하기 좋습니다.' },
            { name: '충장로 분식 골목', district: '동구', category: '분식', reason: '소량씩 여러 가지를 맛보기 좋습니다.' },
        ],
        holySpots: [
            { name: '양림동 근대역사문화마을', district: '남구', content: '드라마 촬영지', note: '근대 가옥 구간이 배경으로 쓰였습니다.' },
            { name: '국립아시아문화전당 일대', district: '동구', content: '공연·팬 행사장', note: '공연 전후 식사 동선과 함께 묶입니다.' },
        ],
        neighbors: ['jeonnam', 'jeonbuk'],
    },
    {
        slug: 'gyeongnam',
        areaCode: '36',
        name: '경남',
        fullName: '경상남도',
        tagline: '항구 도시의 아침 밥상',
        description: '통영, 진주, 남해까지 경남 먹거리 권역을 아침 시장부터 시작하는 동선으로 계획해 보세요.',
        intro: '항구 도시는 아침이 가장 활발합니다. 첫 끼를 시장에서 시작하는 구성이 잘 맞습니다.',
        districts: ['창원시', '진주시', '통영시', '사천시', '김해시', '거제시', '양산시', '남해군', '하동군', '합천군'],
        highlights: [
            { name: '통영·거제 권역', description: '시장과 섬 여행을 붙이기 좋은 구간입니다.', tip: '배 시간에 맞춰 식사 시간을 조정하세요.' },
            { name: '진주 권역', description: '성곽 산책과 향토 음식을 함께 도는 지역입니다.', tip: '비빔밥은 점심 시간대에 회전이 빠릅니다.' },
            { name: '남해·하동 권역', description: '해안 드라이브와 식사를 이어 붙이는 구간입니다.', tip: '이동 거리가 길어 주유·휴게 계획이 필요합니다.' },
        ],
        signatureSpots: [
            { name: '통영 중앙시장', district: '통영시', category: '해산물', reason: '충무김밥과 회를 한 구간에서 해결할 수 있습니다.' },
            { name: '서호시장 아침 상권', district: '통영시', category: '향토음식', reason: '새벽부터 문을 열어 이른 아침 식사가 가능합니다.' },
            { name: '진주 중앙시장', district: '진주시', category: '전통시장', reason: '비빔밥과 냉면을 함께 비교하기 좋습니다.' },
            { name: '마산 어시장', district: '창원시', category: '해산물', reason: '아귀찜 상권이 인근에 이어져 있습니다.' },
            { name: '남해 죽방렴 상권', district: '남해군', category: '향토음식', reason: '멸치쌈밥 위주라 취향 확인이 필요합니다.' },
        ],
        holySpots: [
            { name: '동피랑 벽화마을', district: '통영시', content: '드라마·예능 촬영지', note: '언덕 골목이 배경으로 자주 쓰입니다.' },
            { name: '합천영상테마파크', district: '합천군', content: '드라마·영화 세트장', note: '촬영 세트 관람 후 인근 식당과 묶습니다.' },
        ],
        neighbors: ['busan', 'ulsan', 'daegu'],
    },
    {
        slug: 'busan',
        areaCode: '6',
        name: '부산',
        fullName: '부산광역시',
        tagline: '항구 시장에서 시작하는 하루',
        description: '자갈치, 해운대, 서면까지 부산 먹거리 권역을 지하철 동선에 맞춰 계획해 보세요.',
        intro: '지하철로 대부분의 권역이 연결됩니다. 아침은 시장, 저녁은 해변 쪽으로 옮기는 구성이 편합니다.',
        districts: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '수영구', '기장군'],
        highlights: [
            { name: '남포동·자갈치 권역', description: '수산시장과 먹자골목이 도보로 이어지는 구간입니다.', tip: '야시장은 저녁에 열립니다.' },
            { name: '해운대·광안리 권역', description: '해변 산책과 저녁 식사를 붙이기 좋은 지역입니다.', tip: '불꽃축제 기간에는 예약이 필수입니다.' },
            { name: '서면 권역', description: '카페와 식당이 밀집한 도심 구간입니다.', tip: '지하상가 구조가 복잡해 출구를 미리 확인하세요.' },
        ],
        signatureSpots: [
            { name: '자갈치시장', district: '중구', category: '해산물', reason: '2층 식당가에서 손질까지 이어집니다.' },
            { name: '국제시장 먹자골목', district: '중구', category: '먹자골목', reason: '씨앗호떡·비빔당면을 나눠 먹기 좋습니다.' },
            { name: '부평깡통야시장', district: '중구', category: '야시장', reason: '저녁에만 열려 야간 일정으로 배치합니다.' },
            { name: '전포카페거리', district: '부산진구', category: '카페', reason: '식사 사이 휴식 지점으로 적합합니다.' },
            { name: '기장 대변항 상권', district: '기장군', category: '해산물', reason: '멸치는 봄, 대게는 겨울로 시기가 갈립니다.' },
        ],
        holySpots: [
            { name: '감천문화마을', district: '사하구', content: '드라마·MV 촬영지', note: '골목 전망대 구간이 배경으로 쓰입니다.' },
            { name: '청사포 해안', district: '해운대구', content: '드라마 촬영지', note: '포구 구간과 조개구이 상권이 붙어 있습니다.' },
        ],
        neighbors: ['gyeongnam', 'ulsan'],
    },
    {
        slug: 'ulsan',
        areaCode: '7',
        name: '울산',
        fullName: '울산광역시',
        tagline: '고래와 한우가 나뉘는 두 방향',
        description: '태화강, 장생포, 언양까지 울산 먹거리 권역을 방향을 정해 반나절씩 계획해 보세요.',
        intro: '해안과 내륙의 성격이 뚜렷하게 다릅니다. 한 방향을 골라 반나절씩 잡으세요.',
        districts: ['중구', '남구', '동구', '북구', '울주군'],
        highlights: [
            { name: '태화강 권역', description: '대숲 산책과 시장 먹거리를 잇는 구간입니다.', tip: '여름 저녁은 산책로가 붐빕니다.' },
            { name: '장생포 권역', description: '고래문화마을과 해안 식당을 묶는 지역입니다.', tip: '관람 시설 입장 마감을 확인하세요.' },
            { name: '언양·봉계 권역', description: '불고기 특구를 목적지로 잡는 구간입니다.', tip: '1인분 기준 양이 많아 인원 조절이 필요합니다.' },
        ],
        signatureSpots: [
            { name: '울산 중앙전통시장', district: '중구', category: '전통시장', reason: '도심에 있어 첫 일정으로 넣기 좋습니다.' },
            { name: '장생포 상권', district: '남구', category: '향토음식', reason: '관람 시설과 도보로 이어집니다.' },
            { name: '언양불고기 거리', district: '울주군', category: '고기', reason: '특구로 지정돼 가게 밀집도가 높습니다.' },
            { name: '봉계 한우불고기 특구', district: '울주군', category: '고기', reason: '언양과 조리 방식이 달라 비교해 볼 만합니다.' },
            { name: '정자항 상권', district: '북구', category: '해산물', reason: '대게·가자미 등 계절 품목이 바뀝니다.' },
        ],
        holySpots: [
            { name: '태화강 국가정원', district: '중구', content: 'MV·화보 촬영지', note: '대숲 구간이 영상 배경으로 쓰입니다.' },
            { name: '간절곶', district: '울주군', content: '드라마 촬영지', note: '일출 구간이 배경으로 자주 등장합니다.' },
        ],
        neighbors: ['busan', 'gyeongnam', 'gyeongbuk'],
    },
    {
        slug: 'jeju',
        areaCode: '39',
        name: '제주',
        fullName: '제주특별자치도',
        tagline: '동서로 갈리는 하루 코스',
        description: '동문시장, 서귀포, 애월까지 제주 먹거리 권역을 한쪽으로 몰아 계획해 보세요.',
        intro: '제주시와 서귀포를 하루에 왕복하면 식사 시간이 무너집니다. 동선을 한쪽으로 몰아 잡으세요.',
        districts: ['제주시', '서귀포시', '애월읍', '조천읍', '성산읍', '한림읍', '대정읍', '표선면'],
        highlights: [
            { name: '제주시 권역', description: '재래시장과 고깃집 상권이 도심에 모여 있습니다.', tip: '공항 도착 직후 첫 끼로 넣기 좋습니다.' },
            { name: '서귀포·성산 권역', description: '일출 관람과 아침 식사를 붙이는 구간입니다.', tip: '성산 일출 시간은 계절마다 크게 다릅니다.' },
            { name: '애월·한림 권역', description: '해안도로 카페와 식당이 이어지는 지역입니다.', tip: '주말 오후에는 주차 대기가 깁니다.' },
        ],
        signatureSpots: [
            { name: '동문재래시장', district: '제주시', category: '전통시장', reason: '회·간식·기념품을 한 번에 해결할 수 있습니다.' },
            { name: '흑돼지거리', district: '제주시', category: '고기', reason: '저녁 대기가 길어 예약 가능 여부를 확인하세요.' },
            { name: '서귀포 매일올레시장', district: '서귀포시', category: '전통시장', reason: '포장 위주로 사서 숙소에서 먹기 좋습니다.' },
            { name: '애월 해안도로 카페', district: '애월읍', category: '카페', reason: '일몰 시간에 맞추면 자리 경쟁이 심합니다.' },
            { name: '모슬포항 상권', district: '대정읍', category: '해산물', reason: '방어는 겨울에만 제철입니다.' },
        ],
        holySpots: [
            { name: '성산일출봉 일대', district: '성산읍', content: '드라마·MV 촬영지', note: '해안 구간이 여러 영상에 등장했습니다.' },
            { name: '협재해변 주변', district: '한림읍', content: '화보 촬영지', note: '해변 카페와 묶어 오후 동선이 됩니다.' },
        ],
        neighbors: ['jeonnam', 'busan'],
    },
];

export const foodAreaSlugs = foodAreas.map((area) => area.slug);

export function findFoodArea(slug: string): FoodAreaGuide | undefined {
    return foodAreas.find((area) => area.slug === slug);
}

export function foodAreaPath(slug: string) {
    return `/travel/food/${slug}`;
}

export function foodAreaEntryPoint(slug: string, suffix?: string) {
    return `seo_food_${slug}${suffix ? `_${suffix}` : ''}`;
}

// ─── K-POP 여행 가이드 ───────────────────────────────────────────────
// 맛집과 달리 17개 시·도를 모두 만들지 않는다. 공연장·성지가 실제로 모여 있는
// 지역만 페이지를 두고, 성지 데이터가 쌓이는 만큼 늘린다.
// 내용 없는 지역 페이지를 미리 찍어 두면 저품질 페이지만 늘어난다.

export interface KpopAreaGuide {
    slug: string;
    areaCode: string;
    name: string;
    fullName: string;
    tagline: string;
    description: string;
    intro: string;
    districts: string[];
    highlights: Array<{ name: string; description: string; tip: string }>;
    holySpots: HolySpot[];
    neighbors: string[];
}

export const kpopChecklist: string[] = [
    '공연·팝업 일정과 예매 조건을 공식 채널에서 확인',
    '입장 대기와 굿즈 판매 시작 시간을 별도로 확보',
    '한 권역당 핵심 장소 2~3곳으로 압축',
    '공연 종료 시간과 대중교통 막차 대조',
    '촬영지 방문 시 주변 주민·상점에 폐를 끼치지 않기',
];

export const kpopHub = {
    eyebrow: 'K-POP 여행 가이드',
    title: 'K-POP 성지, 공연장이 있는 도시부터',
    description: '서울·경기·인천·부산·강원·대구의 K-POP 권역과 성지를 지역별로 정리했습니다.',
    intro: '아레나와 대형 공연장이 있는 도시를 중심으로 먼저 정리했습니다. 성지 데이터가 쌓이는 지역부터 순차적으로 추가합니다.',
    entryPoint: 'seo_kpop_hub',
};

export const kpopAreas: KpopAreaGuide[] = [
    {
        slug: 'seoul',
        areaCode: '1',
        name: '서울',
        fullName: '서울특별시',
        tagline: '하루 동선으로 가볍게',
        description: '홍대, 성수, 잠실 등 서울의 K-POP 여행 권역을 이동 시간까지 고려해 묶어 보세요.',
        intro: '처음부터 장소를 많이 담기보다 같은 권역을 중심으로 공연, 팝업, 카페를 연결하면 이동 시간을 줄일 수 있습니다.',
        districts: ['마포구', '서대문구', '성동구', '광진구', '송파구', '강남구', '서초구', '용산구', '중구', '종로구', '영등포구'],
        highlights: [
            { name: '홍대·연남 권역', description: '버스킹과 음반·굿즈 탐색을 함께 즐기기 좋은 지역입니다.', tip: '도보 이동을 중심으로 2~3곳을 묶어 보세요.' },
            { name: '성수 권역', description: '브랜드와 아티스트 팝업이 열리는 공간을 탐색하기 좋은 지역입니다.', tip: '방문 전 공식 채널에서 운영 일정을 확인하세요.' },
            { name: '잠실 권역', description: '대형 공연 관람 전후 식사와 산책 동선을 만들기 좋은 지역입니다.', tip: '공연 종료 시간과 막차 시간을 먼저 반영하세요.' },
        ],
        holySpots: [
            { name: '홍대 걷고싶은거리', district: '마포구', content: '버스킹 성지', note: '주말 저녁에 거리 공연이 가장 많습니다.' },
            { name: '올림픽공원·KSPO돔 일대', district: '송파구', content: '대형 공연장', note: '공연일에는 주변 식당 대기가 길어집니다.' },
            { name: '성수동 팝업 상권', district: '성동구', content: '아티스트 팝업', note: '팝업은 기간 한정이라 방문 전 확인이 필요합니다.' },
        ],
        neighbors: ['gyeonggi', 'incheon'],
    },
    {
        slug: 'gyeonggi',
        areaCode: '31',
        name: '경기',
        fullName: '경기도',
        tagline: '대형 공연장이 모인 수도권 외곽',
        description: '킨텍스와 고양종합운동장 등 대형 공연이 열리는 경기 권역을 이동 시간에 맞춰 계획해 보세요.',
        intro: '서울 도심보다 공연장 규모가 커 이동과 귀가에 시간이 더 걸립니다. 공연 전후 동선을 먼저 잡는 편이 안전합니다.',
        districts: ['고양시', '성남시', '수원시', '용인시', '파주시', '부천시', '안양시', '하남시', '남양주시', '가평군'],
        highlights: [
            { name: '고양·일산 권역', description: '전시장과 대형 경기장이 붙어 있어 시상식·팬미팅이 자주 열립니다.', tip: '행사일에는 주변 숙소가 빠르게 찹니다.' },
            { name: '성남·분당 권역', description: '공연장과 상권이 가까워 공연 전후 식사를 붙이기 좋습니다.', tip: '지하철 막차 시간을 먼저 확인하세요.' },
            { name: '파주 권역', description: '촬영지와 전시 공간을 함께 도는 구성이 어울립니다.', tip: '월요일 휴관 시설이 많습니다.' },
        ],
        holySpots: [
            { name: '킨텍스 일대', district: '고양시', content: '시상식·팬미팅', note: '행사 종료 시간에 맞춰 셔틀과 지하철이 붐빕니다.' },
            { name: '고양종합운동장', district: '고양시', content: '대형 콘서트', note: '공연 후 귀가 동선을 미리 정해 두는 편이 좋습니다.' },
        ],
        neighbors: ['seoul', 'incheon'],
    },
    {
        slug: 'incheon',
        areaCode: '2',
        name: '인천',
        fullName: '인천광역시',
        tagline: '아레나와 공항이 가까운 도시',
        description: '영종도 아레나와 송도 축제 공간 등 인천의 K-POP 권역을 공항 동선과 함께 계획해 보세요.',
        intro: '공항에서 가까워 입·출국 일정과 붙이기 좋습니다. 다만 도심과 영종도는 거리가 있어 하루에 묶기 어렵습니다.',
        districts: ['중구', '연수구', '미추홀구', '남동구', '부평구', '계양구', '서구', '동구'],
        highlights: [
            { name: '영종도 아레나 권역', description: 'K-POP 공연을 염두에 두고 지어진 아레나가 있는 구간입니다.', tip: '공항철도 막차 시간을 먼저 확인하세요.' },
            { name: '송도 권역', description: '대형 야외 페스티벌이 열리는 공원과 상권이 붙어 있습니다.', tip: '야외 행사는 날씨에 따라 일정이 바뀝니다.' },
            { name: '개항장 권역', description: '근대 건축 거리가 촬영 배경으로 자주 쓰이는 구간입니다.', tip: '주말 오후는 혼잡하니 오전에 시작하세요.' },
        ],
        holySpots: [
            { name: '인스파이어 아레나 일대', district: '중구', content: 'K-POP 아레나', note: '공항과 가까워 출국 전날 일정으로 넣기 좋습니다.' },
            { name: '송도달빛축제공원', district: '연수구', content: '대형 페스티벌', note: '야외 공연이라 우천 대비가 필요합니다.' },
        ],
        neighbors: ['seoul', 'gyeonggi'],
    },
    {
        slug: 'busan',
        areaCode: '6',
        name: '부산',
        fullName: '부산광역시',
        tagline: '바다와 공연장을 한 동선으로',
        description: '벡스코와 해운대, 광안리 등 부산의 K-POP 권역을 해변 동선과 함께 계획해 보세요.',
        intro: '공연장과 해변이 지하철로 이어져 공연 전후 시간을 채우기 좋습니다.',
        districts: ['해운대구', '수영구', '부산진구', '중구', '남구', '사하구', '동래구', '기장군'],
        highlights: [
            { name: '해운대·벡스코 권역', description: '대형 공연과 팬미팅이 열리는 전시장이 해변과 가깝습니다.', tip: '행사일에는 인근 숙소를 미리 잡으세요.' },
            { name: '서면 권역', description: '공연 전후 식사와 카페를 붙이기 좋은 도심 구간입니다.', tip: '지하상가 구조가 복잡해 출구를 확인하세요.' },
            { name: '광안리·기장 권역', description: '해안 풍경이 영상 배경으로 자주 쓰이는 구간입니다.', tip: '일몰 시간대에 사람이 몰립니다.' },
        ],
        holySpots: [
            { name: '벡스코 일대', district: '해운대구', content: '대형 공연·팬미팅', note: '행사 종료 후 지하철이 크게 붐빕니다.' },
            { name: '광안리 해변', district: '수영구', content: 'MV·화보 촬영지', note: '광안대교 야경 구간이 배경으로 자주 등장합니다.' },
        ],
        neighbors: ['daegu', 'seoul'],
    },
    {
        slug: 'gangwon',
        areaCode: '32',
        name: '강원',
        fullName: '강원특별자치도',
        tagline: '앨범 재킷 속 바다',
        description: '주문진과 속초, 춘천 등 앨범·MV 촬영지로 알려진 강원 권역을 계획해 보세요.',
        intro: '촬영지가 해안을 따라 흩어져 있어 하루에 한 권역만 잡는 편이 안전합니다.',
        districts: ['강릉시', '속초시', '춘천시', '원주시', '양양군', '고성군', '평창군', '정선군'],
        highlights: [
            { name: '강릉·주문진 권역', description: '앨범 재킷 촬영지와 해변 카페를 한 줄로 잇는 구간입니다.', tip: '버스정류장 앞은 촬영 대기가 길어질 수 있습니다.' },
            { name: '속초 권역', description: '항구와 해변을 함께 도는 구성이 어울립니다.', tip: '성수기 주말은 주차 시간을 별도로 잡으세요.' },
            { name: '춘천 권역', description: '드라마 촬영지와 호반 산책을 붙이기 좋은 지역입니다.', tip: '역세권에 상권이 모여 있어 뚜벅이 여행에 맞습니다.' },
        ],
        holySpots: [
            { name: '주문진 방파제 버스정류장', district: '강릉시', content: 'BTS 앨범 재킷 촬영지', note: '주민 통행로이므로 촬영 순서를 지켜 주세요.' },
            { name: '향호해변', district: '강릉시', content: '팬 방문지', note: '주문진 방파제와 도보로 이어집니다.' },
        ],
        neighbors: ['seoul', 'gyeonggi'],
    },
    {
        slug: 'daegu',
        areaCode: '4',
        name: '대구',
        fullName: '대구광역시',
        tagline: '음악 거리와 스타디움',
        description: '대구스타디움과 김광석길 등 대구의 음악·공연 권역을 도심 동선으로 계획해 보세요.',
        intro: '대형 공연장은 도심에서 떨어져 있고 음악 거리는 중구에 모여 있습니다. 두 축을 나눠 잡으세요.',
        districts: ['중구', '수성구', '달서구', '동구', '남구', '북구', '서구', '달성군'],
        highlights: [
            { name: '수성·스타디움 권역', description: '대형 콘서트가 열리는 경기장이 있는 구간입니다.', tip: '공연 후 귀가 교통편을 미리 확인하세요.' },
            { name: '동성로 권역', description: '공연 전후 식사와 카페가 밀집한 도심 구간입니다.', tip: '주말 저녁은 이동 속도가 크게 느려집니다.' },
            { name: '김광석길 권역', description: '음악을 주제로 한 거리와 벽화가 이어지는 구간입니다.', tip: '평일 낮이 가장 한산합니다.' },
        ],
        holySpots: [
            { name: '대구스타디움 일대', district: '수성구', content: '대형 콘서트', note: '도심에서 떨어져 있어 이동 시간을 넉넉히 잡으세요.' },
            { name: '김광석다시그리기길', district: '중구', content: '음악 성지', note: '벽화 거리와 인근 카페가 함께 묶입니다.' },
        ],
        neighbors: ['busan', 'seoul'],
    },
];

export const kpopAreaSlugs = kpopAreas.map((area) => area.slug);

export function findKpopArea(slug: string): KpopAreaGuide | undefined {
    return kpopAreas.find((area) => area.slug === slug);
}

export function kpopAreaPath(slug: string) {
    return `/travel/kpop/${slug}`;
}

export function kpopAreaEntryPoint(slug: string, suffix?: string) {
    return `seo_kpop_${slug}${suffix ? `_${suffix}` : ''}`;
}
