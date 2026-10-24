# KRIDE 홈·탐색 모션 적용

## 변경 동작

- 홈 및 K-POP·맛집 랜딩 히어로: 핑크·민트·베이비 블루 배경, 제목 등장, 배경 재생/멈춤.
- 화면 밖 또는 비활성 탭에서는 배경 모션을 일시 중단한다.
- 홈 카드: 마우스 위치에 따라 최대 3도 기울임. 터치에서는 틸트를 실행하지 않는다.
- 탐색: 카테고리 선택 표시 이동, 버튼 호버·누름·리플, 처음 6개 카드의 40ms 간격 등장, 사진의 작은 확대, 카드 위치 재배치.
- 장소 저장: 기존 로컬 저장 상태와 연결한 아이콘 반응. 기존 브라우저 저장 방식은 유지한다.
- 지도: 번호가 있는 키보드 조작 가능한 핀. 핀 내부가 한 번 등장하며 카드 선택과 강조 상태를 공유한다. 지도 SDK의 좌표 배치 요소는 애니메이션하지 않는다.
- 상세: 짧은 페이드·상승. 기존 닫기·Escape·포커스 복원은 유지한다.
- 기기의 동작 줄이기 설정이 실행 중 바뀌어도 즉시 반영한다. 배경·틸트·리플·바운스 및 부드러운 지도 이동을 줄이고 색상과 선택 상태를 유지한다.

## 핵심 파일

| 파일 | 역할 |
|---|---|
| `components/motion/KrideMotion.tsx` | 공통 모션 설정, 실시간 동작 줄이기 구독, 틸트, 리플, 배경 |
| `app/styles/kride-motion.css` | 공통 배경 및 모션 장식 |
| `components/plugins/travel/TourPoiCard.tsx` | 카드 등장·기울임·저장 반응 |
| `components/plugins/travel/TourExploreMap.tsx` | 좌표에 고정된 커스텀 핀과 선택 연결 |
| `components/plugins/travel/TourExploreScreen.tsx` | 필터 반응·카드 순서·상세 등장 |
| `app/page.tsx`, `components/marketing/*Landing.tsx` | 홈 및 여행 랜딩 연결 |

Framer Motion은 기존 의존성을 사용하며 패키지 버전을 변경하지 않는다.

## 검증 범위

- 관련 Jest: `KrideMotion`, `TourExploreScreen`, `TourExploreMap`, `TourPoiCard`, `PoiImage`.
- 배경 정지·재생, 화면 밖 정지, 실행 중 동작 줄이기 반영, 구독 해제, 지도 핀 선택·강조·이벤트 정리를 포함한다.
- TypeScript 검사와 Next.js 프로덕션 빌드를 실행한다.
- ESLint: 수정 파일 오류 0개. 탐색 화면의 기존 resultEpoch 정리 경고 1개는 남아 있다.
- 운영 브라우저에서 새 버전의 시각 확인, 모바일 실제 터치, 실제 Kakao SDK 동작은 배포 후 별도 검증해야 한다. 단위 시험의 지도 SDK 모의 객체는 실제 지도 검증을 대체하지 않는다.

## 배포 상태

코드 준비·자동 검증과 운영 반영은 구분한다. 배포 대상은 최근 운영 기록의
`https://kmovement.srv1869569.hstgr.cloud`이다.

기존 `.github/workflows/hostinger-web-publish.yml`은 정확한 소스 SHA를 받아 이미지만 게시한다. 이 워크플로 성공만으로 Hostinger 컨테이너 교체 완료로 판단하지 않는다.
배포 시 기존 환경변수를 보존하고 웹 컨테이너만 교체하며, 기존 이미지·환경 파일로 복구할 수 있게 기록해야 한다.
