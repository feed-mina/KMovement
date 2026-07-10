import { TourPoi } from '@/services/tourApi';

// K-컬처 성지 큐레이션 데이터셋 (1차) — Epic #74 · #78.
// 잘 알려진 공개 장소의 사실 기반 정보(촬영지·성지) 소수 큐레이션.
// 대규모 크롤/외부연동은 2차(별도).
export const HOLY_SITES: TourPoi[] = [
    {
        contentId: 'holy-ttukseom', title: '뚝섬한강공원', addr: '서울특별시 광진구 강변북로 139',
        mapX: 127.0693, mapY: 37.5311, contentTypeId: 'HOLY',
        artist: 'BTS·aespa', fandomInfo: 'K-pop 뮤비·예능 단골 촬영지', recommendReason: '한강뷰 인증샷 명당, 근처 카페 동선과 묶기 좋아요.',
    },
    {
        contentId: 'holy-bukchon', title: '북촌 한옥마을', addr: '서울특별시 종로구 계동길 37',
        mapX: 126.9850, mapY: 37.5826, contentTypeId: 'HOLY',
        artist: 'IVE·NewJeans', fandomInfo: '화보·뮤비 한옥 배경 성지', recommendReason: '한복 대여 후 촬영하기 좋은 골목, 경복궁과 도보 코스.',
    },
    {
        contentId: 'holy-seoulforest', title: '서울숲', addr: '서울특별시 성동구 뚝섬로 273',
        mapX: 127.0374, mapY: 37.5444, contentTypeId: 'HOLY',
        artist: 'aespa', fandomInfo: '뮤비 촬영지 · 팬 성지', recommendReason: '산책 동선이 좋고 성수 카페거리와 이어져요.',
    },
    {
        contentId: 'holy-namsan', title: '남산서울타워', addr: '서울특별시 용산구 남산공원길 105',
        mapX: 126.9883, mapY: 37.5512, contentTypeId: 'HOLY',
        artist: '다수', fandomInfo: '드라마·예능·뮤비 대표 촬영지', recommendReason: '서울 전경 야경 명소, 사랑의 자물쇠 인증.',
    },
    {
        contentId: 'holy-banpo', title: '반포한강공원 무지개분수', addr: '서울특별시 서초구 신반포로11길 40',
        mapX: 126.9963, mapY: 37.5100, contentTypeId: 'HOLY',
        artist: '다수', fandomInfo: '뮤비·예능 야경 촬영지', recommendReason: '저녁 분수쇼 시간대 방문 추천, 치맥 성지.',
    },
    {
        contentId: 'holy-seongsu', title: '성수동 카페거리', addr: '서울특별시 성동구 연무장길',
        mapX: 127.0558, mapY: 37.5444, contentTypeId: 'HOLY',
        artist: 'NewJeans', fandomInfo: '팝업·화보 성지', recommendReason: '아이돌 팝업스토어가 자주 열리는 핫플, 감성 카페 밀집.',
    },
    {
        contentId: 'holy-ddp', title: 'DDP 동대문디자인플라자', addr: '서울특별시 중구 을지로 281',
        mapX: 127.0094, mapY: 37.5669, contentTypeId: 'HOLY',
        artist: '다수', fandomInfo: '패션위크·뮤비 배경', recommendReason: '미래적 건축 배경 촬영, 야간 조명 인증샷.',
    },
    {
        contentId: 'holy-lotte', title: '서울스카이 (롯데월드타워)', addr: '서울특별시 송파구 올림픽로 300',
        mapX: 127.1025, mapY: 37.5126, contentTypeId: 'HOLY',
        artist: '다수', fandomInfo: '전망대 성지', recommendReason: '국내 최고층 전망, 잠실 코스 마무리로 좋아요.',
    },
];
