# Focus Map Provider Plan

작성일: 2026-05-27

## 배경

현재 KRIDE Focus 화면은 추천 일정(`itinerary`)과 지도 데이터(`mapData.markers`)를 함께 받아, 지도와 일정 패널을 나란히 보여주는 구조다. 사용자는 일정 장소를 한눈에 보고 동선을 확인하고 싶고, 장소별 상세 정보도 함께 보기를 원한다. 향후에는 사용자가 직접 장소를 추가하거나 수정하는 기능까지 확장할 수 있어야 한다.

이번 작업의 목표는 기존 Focus 경험을 유지하면서 지도 엔진을 카카오맵과 Google Maps로 확장 가능한 구조로 바꾸는 것이다.

## 사용자 결정 사항

- 핵심 경험: 일정 장소 한눈에 보기, 동선 확인, 장소별 상세 정보 보기
- 확장 방향: 이후 사용자 직접 장소 추가/수정 지원
- 표시 방식: Focus 페이지 안에 지도 컴포넌트로 통합
- 지도 전략: 카카오맵과 Google Maps를 모두 지원하고, 기본값 하나를 두되 사용자가 선택 가능하게 구성

## 현재 구조 요약

### metadata-project

- `KRIDE_FOCUS` 화면에서 `useKrideItinerary`가 `/api/kride/recommend/itinerary`를 호출한다.
- 응답의 `itinerary`와 `mapData.markers`를 page data로 합쳐 DynamicEngine에 넘긴다.
- `MAP_VIEW` 컴포넌트는 현재 Leaflet/OpenStreetMap 기반 구현이다.
- 관련 파일:
  - `subproject/SDUI/metadata-project/app/view/[...slug]/page.tsx`
  - `subproject/SDUI/metadata-project/components/DynamicEngine/hook/useKrideItinerary.ts`
  - `subproject/SDUI/metadata-project/components/fields/kride/MapView.tsx`
  - `subproject/SDUI/metadata-project/components/fields/kride/MapViewInner.tsx`
  - `subproject/SDUI/metadata-project/components/fields/kride/ItineraryPanel.tsx`

### kride

- 별도 Next 앱에서도 Focus 화면이 `mapData.markers`를 `MapView`에 넘긴다.
- 이 앱도 Leaflet 기반 `MapViewInner`를 사용한다.
- 관련 파일:
  - `subproject/SDUI/kride/src/app/(afterLogin)/focus/page.tsx`
  - `subproject/SDUI/kride/src/components/kride/MapView.tsx`
  - `subproject/SDUI/kride/src/components/kride/MapViewInner.tsx`
  - `subproject/SDUI/kride/src/components/kride/ItineraryPanel.tsx`

## 권장 제품 방향

### 1차 구현

Focus 화면 내부에서 다음 기능을 제공한다.

- 지도 제공자 선택: `카카오 | Google`
- 기본 제공자: 카카오맵
- 마커 표시: 일정 장소 순서대로 번호 마커 표시
- 동선 표시: 마커 순서대로 polyline 표시
- 장소 상세: 마커 클릭 시 장소명, 설명, Day, 시간대, 주소, 외부 지도 열기 표시
- 일정 연동: 일정 패널의 장소 클릭 시 지도 중심 이동 및 해당 마커 강조

### 2차 확장

- Google Maps를 기본 제공자 또는 사용자 설정으로 선택 가능
- 장소 검색/좌표 보정
- 일정 장소 직접 추가/삭제/순서 변경
- 사용자별 지도 선호도 저장

### 3차 확장

- Google My Maps 내보내기 또는 공유 링크 생성
- 여행 일정 공유 페이지 생성
- 저장된 일정의 공개/비공개 권한 관리

## 지도 제공자 판단

### Kakao Maps

장점:

- 한국 장소명, 주소, POI 검색에 강하다.
- 국내 사용자에게 익숙한 지도 UI다.
- JavaScript SDK에서 지도, 마커, 인포윈도우, 폴리라인을 직접 제어할 수 있다.

주의점:

- 카카오 개발자 앱 키와 도메인 등록이 필요하다.
- CSP에 `dapi.kakao.com`, `t1.daumcdn.net`, `t1.kakaocdn.net` 등 스크립트/이미지 출처를 허용해야 한다.
- 해외 사용자에게는 Google Maps보다 익숙하지 않을 수 있다.

### Google Maps JavaScript API

장점:

- 글로벌 사용자와 다국어 지도 UI에 적합하다.
- 마커, 폴리라인, 지도 중심 이동, 장소 상세 확장이 쉽다.
- 외국인 사용자가 여행 동선을 이해하기 쉽다.

주의점:

- Google Maps Platform API key와 결제 설정이 필요할 수 있다.
- CSP에 Google Maps 스크립트/이미지/연결 출처를 추가해야 한다.
- 한국 내 일부 장소 데이터는 카카오가 더 자연스러울 수 있다.

### Google My Maps

장점:

- 공유 가능한 여행 지도 산출물로 적합하다.
- 사용자가 별도 지도로 보관하거나 공유하기 좋다.

주의점:

- 앱 내부의 동적 상호작용에는 JavaScript API보다 제약이 크다.
- 임베드하려면 지도가 public이어야 한다.
- 개인별 실시간 일정 생성/수정 기능의 메인 지도 엔진으로는 적합하지 않다.

결론:

- 메인 지도 엔진은 Kakao Maps + Google Maps JavaScript API로 구성한다.
- Google My Maps는 나중에 "공유/내보내기" 기능으로 추가한다.

## 제안 아키텍처

### 공통 데이터 모델

지도 제공자와 무관하게 Focus 화면은 아래 형태의 데이터를 사용한다.

```ts
type RouteMapProvider = "kakao" | "google";

type RouteMapMarker = {
  id: string;
  index: number;
  day?: number;
  slot?: "morning" | "afternoon" | "evening" | string;
  name: string;
  description?: string;
  address?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  externalUrls?: {
    kakao?: string;
    google?: string;
  };
};

type RouteMapData = {
  provider?: RouteMapProvider;
  center: [number, number];
  zoom: number;
  markers: RouteMapMarker[];
};
```

### 컴포넌트 구조

```text
RouteMap
  RouteMapProviderToggle
  KakaoRouteMap
  GoogleRouteMap
  RouteMapEmptyState
  RouteMapErrorState
```

역할:

- `RouteMap`: 공통 props, provider 선택, fallback 처리
- `KakaoRouteMap`: Kakao SDK 로딩, 마커, 인포윈도우, 폴리라인 렌더링
- `GoogleRouteMap`: Google Maps SDK 로딩, 마커, 폴리라인 렌더링
- `RouteMapProviderToggle`: 지도 제공자 전환 UI
- `ItineraryPanel`: 장소 클릭 이벤트를 `RouteMap`으로 전달하거나 공유 상태를 통해 선택 장소 동기화

## 구현 단계

### Phase 0. 사전 확인

- 카카오 JavaScript 키 발급 여부 확인
- Google Maps JavaScript API 키 발급 여부 확인
- 배포 도메인 확인
- 현재 운영 대상 앱이 `metadata-project`인지 `kride`인지 확정

### Phase 1. 공통 지도 모델 정리

- `mapData.markers`를 `RouteMapMarker[]`로 normalize하는 유틸 추가
- `lat/lng/lon` 혼용을 `lat/lng`로 통일
- marker index를 0 기반/1 기반 중 하나로 통일
- itinerary의 Day/시간대 정보와 marker를 매칭할 수 있는 id 규칙 정의

### Phase 2. Kakao 지도 렌더러 추가

- Kakao SDK script loader 작성
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` 환경 변수 사용
- 지도 생성 및 bounds 자동 맞춤
- 번호 마커, 인포윈도우, polyline 표시
- 마커 클릭 시 장소 상세 표시
- 일정 패널 클릭 시 해당 마커로 이동

### Phase 3. Google 지도 렌더러 추가

- Google Maps JS SDK loader 작성
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 환경 변수 사용
- Kakao 렌더러와 동일한 props 계약 유지
- 마커, 정보창, polyline 표시
- Google 지도 외부 열기 URL 생성

### Phase 4. Focus UI 통합

- 기존 `MapView`를 `RouteMap`으로 교체하거나 내부에서 provider를 분기
- 상단에 카카오/Google segmented control 배치
- 기본 provider를 `kakao`로 설정
- provider 선택값은 우선 localStorage 저장
- 향후 로그인 사용자 설정 저장으로 확장 가능하게 key 이름 지정

### Phase 5. CSP 및 설정 반영

- `metadata-project/next.config.ts`에 Kakao/Google Maps 출처 추가
- 배포 환경 변수 문서화
- 로컬 `.env.local` 예시 업데이트 여부 검토

### Phase 6. 검증

자동 검증:

- marker normalize 유틸 단위 테스트
- provider 선택 UI 렌더링 테스트
- 빈 marker 배열일 때 empty state 테스트

수동 검증:

- Focus 진입 시 카카오맵이 기본으로 표시되는지 확인
- Google로 전환 시 같은 장소/동선이 표시되는지 확인
- 일정 패널 장소 클릭 시 지도 중심이 이동하는지 확인
- 마커 클릭 시 장소 상세가 열리는지 확인
- 모바일 화면에서 지도/일정 패널이 겹치지 않는지 확인
- API key 누락 시 오류 화면이 과하게 깨지지 않는지 확인

## 예상 수정 파일

우선순위가 높은 파일:

- `subproject/SDUI/metadata-project/components/fields/kride/MapView.tsx`
- `subproject/SDUI/metadata-project/components/fields/kride/MapViewInner.tsx`
- `subproject/SDUI/metadata-project/components/fields/kride/ItineraryPanel.tsx`
- `subproject/SDUI/metadata-project/components/DynamicEngine/hook/useKrideItinerary.ts`
- `subproject/SDUI/metadata-project/next.config.ts`

추가될 가능성이 높은 파일:

- `subproject/SDUI/metadata-project/components/fields/kride/maps/RouteMap.tsx`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/KakaoRouteMap.tsx`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/GoogleRouteMap.tsx`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/mapTypes.ts`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/normalizeRouteMapData.ts`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/loadKakaoMaps.ts`
- `subproject/SDUI/metadata-project/components/fields/kride/maps/loadGoogleMaps.ts`

별도 `kride` 앱에도 동일 반영이 필요하면 다음 파일도 대상이다.

- `subproject/SDUI/kride/src/components/kride/MapView.tsx`
- `subproject/SDUI/kride/src/components/kride/MapViewInner.tsx`
- `subproject/SDUI/kride/src/components/kride/ItineraryPanel.tsx`

## 환경 변수

```env
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_KRIDE_MAP_DEFAULT_PROVIDER=kakao
```

## 리스크와 대응

- API key 미설정: provider별 error state와 Leaflet fallback 여부 결정
- CSP 차단: 지도 SDK script, tile image, API connection 출처를 명시적으로 추가
- 좌표 누락: 장소명 기반 geocoding이 필요하므로 백엔드 또는 프론트 보정 전략 결정
- 일정과 마커 매칭 실패: marker id 규칙을 itinerary 생성 단계에서 함께 내려주도록 요청
- 비용 이슈: Google Maps 사용량 제한과 쿼터 확인 필요
- 모바일 레이아웃: 지도와 일정 패널을 세로 스택 또는 bottom sheet 형태로 전환 검토

## 오픈 질문

1. 실제 운영 화면은 `metadata-project`의 `KRIDE_FOCUS`가 맞는가, 아니면 `kride` 앱의 `/focus`도 함께 수정해야 하는가?
2. 카카오맵을 기본값으로 확정해도 되는가?
3. API key는 이미 발급되어 있는가?
4. 추천 API가 장소별 좌표, 주소, 이미지 URL, day/slot 정보를 안정적으로 내려줄 수 있는가?
5. Google My Maps 공유는 이번 범위에서 제외하고 후속 기능으로 둘 것인가?

## 참고 문서

- Kakao 지도 Web API: https://apis.map.kakao.com/web/documentation/
- Google Maps JavaScript API Shapes/Polyline: https://developers.google.com/maps/documentation/javascript/shapes
- Google Maps Embed API: https://developers.google.com/maps/documentation/embed/embedding-map
- Google My Maps embed help: https://support.google.com/mymaps/answer/3109452
