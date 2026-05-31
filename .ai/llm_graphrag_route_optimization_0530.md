# LLM 프롬프트 개선 + 동선 최적화 + GraphRAG 확장 + UI 개선

> 작성일: 2026-05-30
> 상태: ✅ 구현 완료 + GCP 배포 완료

---

## 배경

Focus 페이지에서 POI가 15개 수집되지만 LLM이 일정에 2개만 배치하고, 동선 최적화가 없어 전주→서울→전주 같은 비효율 경로가 생기는 문제를 해결.

---

## 변경 1: POI 지리적 클러스터링 — 동선 최적화

**파일**: `src/api/rag_client.py`

- `_haversine()` 함수 추가 (좌표 간 거리 계산)
- `_cluster_pois_by_proximity()` 함수 추가 — Nearest Neighbor 휴리스틱으로 POI를 지리적 순서 정렬
- 좌표 없는 POI는 끝에 배치

---

## 변경 2: LLM 프롬프트 전면 개선

**파일**: `src/api/rag_client.py` — `generate_itinerary()`

### 일정별 고정 POI 배분:
| 일정 | top_k | 배분 |
|------|-------|------|
| 당일치기 | 8 | 오전 4, 오후 4 |
| 1박2일 | 11 | 1일차: 오전 3 + 오후 3, 2일차: 오전 3 + 오후 2 |
| 2박3일 | 15 | 1일차: 오전 3 + 오후 2, 2일차: 오전 3 + 오후 3, 3일차: 오전 2 + 오후 2 |

### 프롬프트 변경사항:
1. **시스템 프롬프트**: "동선 최적화 전문가" 역할 추가, 같은 지역 장소 묶기 지시
2. **유저 프롬프트**: 정확한 배분 수 명시 + 중요 규칙 4가지 + 클러스터링된 POI 목록
3. **출력 형식**: `tip` → `reason` (추천 이유 문장)
4. **max_tokens**: 1500 → 3000
5. **POI context**: 주소에서 지역 추출하여 그룹별(`[서울특별시 강남구]`, `[전주시 완산구]` 등)로 표시

### JSON 출력 형식:
```json
{
  "itinerary": [{
    "day": 1,
    "morning": {
      "places": [
        {"name": "장소명", "address": "주소", "reason": "추천 이유 한 문장"}
      ]
    },
    "afternoon": { ... }
  }]
}
```

---

## 변경 3: GraphRAG 확장

**파일**: `src/api/graphrag_client.py` (신규 생성)

기존 `models/kride_graph.json` 활용:
- **그래프 로드**: nodes → `nodes_by_id`, edges → 양방향 인접 리스트 `adj`, community별 POI 그룹
- **2-hop 이웃 탐색**: Artist → POI → Artist → POI
- **커뮤니티 기반 확장**: 이미 발견된 community 내 POI 우선 추가
- 기존 POI와 중복 제거 후 최대 10건 반환
- 표준 POI 형식 변환 (`poi_id`, `name`, `lat`, `lon`, `address`, `category`, `sido`, `source: "graphrag"`)

---

## 변경 4: FastAPI 서버 연동

**파일**: `src/api/fastapi_server.py`

### 임포트 추가:
- `_cluster_pois_by_proximity` (from `rag_client`)
- `get_graphrag_pois` (from `graphrag_client`) + `HAS_GRAPHRAG` 플래그

### `/api/recommend/itinerary` 엔드포인트 변경:

1. **Stage 3.5**: GraphRAG POI 확장 (Stage 3 ChromaDB 이후, Stage 4 앙상블 이전)
2. **동적 top_k**: duration별 8/11/15 자동 설정 (기존 하드코딩 15)
3. **앙상블 합산**: `neo4j_pois + graphrag_pois`를 함께 앙상블 랭킹에 전달
4. **Stage 4-2**: `_cluster_pois_by_proximity(all_pois)` 호출 → LLM 전달 전 동선 최적화

### 콘솔 로그:
```
[K-Ride] graphrag_pois: N건
[K-Ride] 앙상블 랭킹: N건 (neo4j=X + chroma=Y + graphrag=Z, top_k=K)
[K-Ride] 클러스터링 완료: N건 POI → LLM 전달
```

---

## 변경 5: 아코디언 UI — 추천 이유 표시

**파일**: `subproject/SDUI/metadata-project/components/fields/kride/atoms/RouteNode.tsx`

- `reason` 필드 추출: `data?.reason || data?.tip || ""`
- 주소(`text-gray-400`) 아래에 `text-yellow-400/80 text-[11px]` 노란색 텍스트로 렌더링
- 기존 `tip` 필드도 fallback으로 호환

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `src/api/rag_client.py` | `_haversine()`, `_cluster_pois_by_proximity()` 추가, 프롬프트 전면 개선, reason 필드, max_tokens 3000 |
| `src/api/graphrag_client.py` | **신규** — graph.json 로드, 2-hop + community 기반 POI 확장 |
| `src/api/fastapi_server.py` | duration별 top_k 동적 설정, GraphRAG Stage 3.5, 클러스터링 적용, 로그 강화 |
| `RouteNode.tsx` | reason 필드 렌더링 추가 (주소 아래 노란색 텍스트) |

---

## 검증 방법

1. 서버 재시작 후 Focus 페이지에서 각 duration별 일정 생성
2. 콘솔에서 확인:
   - 당일치기: morning 4 + afternoon 4 = 8곳
   - 1박2일: 6 + 5 = 11곳
   - 2박3일: 5 + 6 + 4 = 15곳
3. 같은 지역 장소가 같은 시간대에 묶였는지
4. 아코디언에서 장소명 + 주소 + 추천이유가 모두 보이는지
5. `[K-Ride] graphrag_pois` 로그 확인

---

## CI 테스트 이슈 — `_cluster_pois_by_proximity` NameError [해결]

### 현상
CI 환경(GitHub Actions pytest)에서 `TestItinerary` 7개 테스트 전부 실패:
```
NameError: name '_cluster_pois_by_proximity' is not defined
```

### 원인
`_cluster_pois_by_proximity`를 `rag_client.py`의 다른 함수들(chromadb, groq 의존)과 같은 `try` 블록에서 import.
CI에서 chromadb/groq 미설치 → `ImportError` → fallback 경로에 `_cluster_pois_by_proximity` 정의 없음.

### 해결
`fastapi_server.py`에서 별도 `try/except` 블록으로 분리:
```python
# POI 클러스터링 (math만 의존, 외부 모듈 불필요)
try:
    from src.api.rag_client import _cluster_pois_by_proximity
except ImportError:
    def _cluster_pois_by_proximity(pois: list) -> list:
        return pois
```

---

## GCP FastAPI 배포 이슈 — 구버전 엔드포인트 [해결]

### 현상
챗봇에서 일정 생성 요청 시 HTTP 500 에러:
```json
{"status":"error","message":"서버 오류가 발생했습니다","error":"InternalError"}
```

### 진단 과정
1. **에러 흐름 추적**:
   - 프론트 `useKrideChatStream` → intent `"itinerary"` → POST `/api/v1/kride/chat`
   - Spring Boot `handleItinerary()` → `FastApiChatClient.generateItinerary()`
   - → GCP FastAPI `POST /api/recommend/itinerary` → **400 Bad Request**

2. **GCP 서버 상태 확인**:
   - `curl http://34.64.221.240:8000/api/health` → 200 OK (서버 자체는 정상)
   - `curl http://34.64.221.240:8000/openapi.json` → `/api/recommend/itinerary` 엔드포인트 **미존재**
   - 기본 엔드포인트만 존재: `/api/health`, `/api/recommend`, `/api/route`, `/api/course`, `/api/facilities`, `/api/pois`

3. **근본 원인**: GCP Docker 컨테이너가 챗봇/일정 관련 엔드포인트 추가 이전의 **구버전 코드**를 실행 중.
   GitHub Actions `deploy-gcp.yml`이 성공으로 표시되었지만 이미지가 제대로 갱신되지 않았음.

### 해결
`gh workflow run deploy-gcp.yml --ref main`으로 수동 재배포 트리거:
- Run ID: `26676868243`
- 빌드 + 배포 약 8분 소요
- 컨테이너 재생성: `kride-fastapi-1 Recreated`, `kride-celery-worker-1 Recreated`

### 배포 후 검증
```bash
# 엔드포인트 확인 — 13개 모두 등록
curl http://34.64.221.240:8000/openapi.json → /api/recommend/itinerary ✅

# 일정 생성 테스트
curl -X POST http://34.64.221.240:8000/api/recommend/itinerary \
  -d '{"duration":3}' → itinerary JSON 정상 반환 ✅
  # reason 필드 포함 확인 ✅
```

### 관련 설정
| 항목 | 값 |
|------|-----|
| GCP VM IP | `34.64.221.240` |
| FastAPI 포트 | 8000 |
| Deploy workflow | `.github/workflows/deploy-gcp.yml` |
| Spring Boot 설정 | `kride.fastapi.url: http://34.64.221.240:8000` (`application-prod.yml:41`) |
| Docker 이미지 | `asia-northeast3-docker.pkg.dev/.../kride-ai/fastapi-server:latest` |

---

## 변경 6: GraphRAG → recommend/ai, chat/qa, chat/stream 확장

### 배경
변경 4에서 `itinerary`에만 GraphRAG를 적용했으나, `recommend/ai`와 `chat/qa`/`chat/stream`에도 확장 적용.

### graphrag_client.py 추가 함수

| 함수 | 역할 |
|------|------|
| `_build_artist_name_index()` | 그래프 Artist 노드 이름(한글) → artist_id 매핑 생성 |
| `_get_artist_name_index()` | 싱글턴 캐시된 인덱스 반환 |
| `search_artists_by_name(names)` | 이름 리스트 → artist_id 리스트 (영문/한글 모두 지원) |
| `extract_artist_ids_from_text(text)` | 자유 텍스트에서 아티스트 이름 substring 매칭 → artist_id 리스트 |
| `get_graphrag_context_for_chat(message, artist_names, max_pois)` | 채팅용 통합 함수: 이름 기반 + 텍스트 추출 → POI 반환 |

### recommend/ai 변경 (`fastapi_server.py`)
- **Stage 2.5** 추가: `search_artists_by_name()` → `get_graphrag_pois()` → 최대 10건
- Neo4j + ChromaDB + **GraphRAG** 3개 소스 합산 후 중복 제거
- 로그: `[K-Ride] recommend/ai graphrag_pois: N건`

### chat/qa, chat/stream 변경
- `_build_graphrag_chat_context(message)` 헬퍼 함수 추가 (fastapi_server.py)
  - 메시지에서 아티스트 이름 자동 감지 → GraphRAG POI 최대 5건 추출
  - 텍스트 형식으로 변환: `- 장소명 (카테고리) — 주소`
- `generate_chat_answer()`, `generate_chat_answer_stream()` (rag_client.py)
  - `graphrag_context: str` 파라미터 추가
  - LLM 프롬프트에 `[GraphRAG — 관련 아티스트 촬영지/장소]` 섹션 주입
  - 시스템 프롬프트에 "GraphRAG context contains artist-related filming locations" 안내 추가
- 로그: `[K-Ride] chat graphrag_pois: N건`

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/api/graphrag_client.py` | `search_artists_by_name()`, `extract_artist_ids_from_text()`, `get_graphrag_context_for_chat()` 추가 |
| `src/api/fastapi_server.py` | import 확장, `recommend/ai` GraphRAG Stage 2.5, `_build_graphrag_chat_context()`, chat 엔드포인트 연동 |
| `src/api/rag_client.py` | `generate_chat_answer()`, `generate_chat_answer_stream()` — `graphrag_context` 파라미터 추가 |

### CI 테스트
24 passed, 0 failed ✅

---

## 참조 문서
- `.ai/kride_chatbot.md` — Advanced RAG 시스템 아키텍처 가이드 (GraphRAG 도입 시나리오 참고)
- `.ai/backend_engineer/research.md` — FastAPI 엔드포인트 분석
- `.ai/code_review_0527.md` — K3 Groq 모델명 등
- `.ai/issues_0530.md` — 카카오 로그인 리다이렉트 + 챗봇 SSE 400 이슈
