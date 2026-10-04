# A06 · 검색 임계값 카드 (threshold-card)

작성일 2026-10-04 · 기준 커밋 main `ba11961` · 코드 읽기만 수행했고 새로 실행한 시험은 없다.

한 줄 결론: KMovement에는 "검색 점수"가 세 종류 있고, 임계값은 QA 경로의 **distance ≤ 0.25**와 별도 chatbot 경로의 **rerank_score > 0.0** 두 개뿐이다. 추천·일정 경로는 임계값 없이 유사도를 표시만 한다. 세 경로를 한 숫자로 설명하지 않는다.

## 1. 경로별 다섯 칸 (endpoint · metric · 값과 방향 · 설정 위치 · 평가 근거)

| 경로 | endpoint | 함수 | 점수 종류 | 값 · 방향 | 설정 위치 | 평가 근거 |
| --- | --- | --- | --- | --- | --- | --- |
| QA (동기) | `POST /api/chat/qa` (`src/api/fastapi_server.py:1736`) | `generate_chat_answer` (`src/api/rag_client.py:174`) | ChromaDB `distance` | `≤ 0.25`만 컨텍스트에 포함. 작을수록 가까움 | 하드코딩 상수 (`rag_client.py:177`) | 없음. 주석은 "관련성 높음으로 간주"뿐 |
| QA (스트리밍) | `POST /api/chat/stream` (`fastapi_server.py:1711`) | `generate_chat_answer_stream` (`rag_client.py:220`) | ChromaDB `distance` | 위와 같은 `≤ 0.25` | 하드코딩 상수 (`rag_client.py:226`) | 없음 |
| 추천 · 일정 | `POST /api/recommend/ai` (`:1314`, 호출 `:1337`), `POST /api/recommend/itinerary` (`:1422`, 호출 `:1453`) | `search_pois_by_purpose` (`rag_client.py:272`) | `similarity = round(1 - distance, 3)` | **임계값 없음**. 컬렉션당 top_k 8 / 5를 그대로 후보로 씀 | — | — |
| 별도 chatbot | `subproject/NLP/chatbot/chatbot_server.py` (src/api와 다른 서버) | `chat` (`chatbot_chain.py:180`) | TorchServe cross-encoder `rerank_score` (ms-marco 기준) | `> 0.0`만 유지, 상위 `RERANK_TOP_K = 10`. 클수록 관련 | `RERANK_THRESHOLD = 0.0` 함수 안 인라인 (`chatbot_chain.py:200`), `RERANK_TOP_K` (`chatbot/config.py:46`) | 없음 |

계획서 작성 시점에 "QA·스트리밍 경로에 같은 필터가 있는지 미확인"이었던 항목은 이번 조사로 **둘 다 0.25 필터가 있음**으로 확인했다 (`:177`, `:226`).

## 2. 0.25는 무엇의 값인가

- 컬렉션 생성 스크립트 두 개 모두 `metadata={"hnsw:space": "cosine"}`으로 만든다 (`scripts/build_poi_collections.py:136`, `scripts/build_poi_collections_from_graph.py:163,171`).
- 임베딩 모델은 `intfloat/multilingual-e5-small` (`build_poi_collections.py:28`, `build_poi_collections_from_graph.py:38`은 `EMBED_MODEL` 환경변수로 덮어쓸 수 있음). 그래프 기반 스크립트는 `normalize_embeddings=True`로 인덱싱한다 (`:166`).
- 의도된 설정대로라면 Chroma cosine distance = 1 − cosine similarity 이므로 **distance 0.25 ↔ similarity 0.75**에 대응한다.
- **0.75는 정답률 75%가 아니다.** 벡터 간 각도 유사도의 한 지점일 뿐이며, 어떤 질의에서 정답이 0.75 아래로 떨어지는지 측정한 기록이 없다.

## 3. 아직 확인하지 못한 것 (운영 환경과 코드의 차이)

| 항목 | 상태 |
| --- | --- |
| 운영 Chroma 서버(`CHROMA_MODE=http`, `rag_client.py:13-18`)의 실제 컬렉션 metadata가 cosine인지 | **미확인**. 어느 스크립트·설정으로 만들어졌는지 운영에서 읽지 않았다 |
| 질의 임베딩 경로: `torchserve_client.embed_texts_sync` → TorchServe `/predictions/embedder` (`torchserve_client.py:76-90`), 실패 시 로컬 `SentenceTransformer(normalize_embeddings=True)` 폴백 (`:50`) | TorchServe에 올라간 embedder 모델과 정규화 여부 **미확인**. 인덱싱 모델과 다르면 distance 의미가 달라진다 |
| e5 계열의 `query:` / `passage:` 접두어 사용 여부 | **미확인** |
| 0.25를 평가셋으로 고른 근거 | **없음** (이번 조사 범위에서 발견 못함) |
| 추천·일정 경로의 지역 조건 | 문자열 포함 검사 (`_matches_any_region`, `fastapi_server.py:1200-1205`; 일정은 `:1516`). 구조화된 지역코드 동등 비교가 아님 |
| 근거 0건일 때 | 일정 경로는 `poiGrounded=False`·`sourcePoiCount=0`을 응답에 표시하지만 LLM 호출은 계속한다 (`:1620-1623`, `:1674-1675`). QA 경로는 `[참고 자료 없음]` 문구를 프롬프트로 전달한다 (`rag_client.py:183`) |

## 4. 면접에서 말하는 세 문장 (결론 · 코드 근거 · 한계)

1. 결론: "QA 경로는 ChromaDB cosine distance 0.25 이하인 후보만 컨텍스트에 넣고, 추천 경로는 임계값 없이 상위 k개를 쓰며, 별도 chatbot은 cross-encoder 점수 0 초과를 씁니다."
2. 코드 근거: "`rag_client.py` 177행과 226행, `search_pois_by_purpose` 300행, `chatbot_chain.py` 200행입니다. 컬렉션은 cosine space로 만들었습니다."
3. 한계: "0.25는 평가셋으로 고른 값이 아니라 초기 설정값이고, 운영 컬렉션 metadata와 TorchServe embedder 설정은 아직 대조하지 않았습니다. 다음 단계는 사람이 판정한 소규모 질의셋으로 잘못 받아들인 후보와 잘못 버린 후보를 비교하는 것입니다."

## 5. 다음 작업 연결

- A13: 검증할 endpoint 하나를 고정한다 (QA 또는 일정). 이 카드 기준으로는 QA 경로가 임계값 설명에, 일정 경로가 지역 조건·무자료 응답 설명에 맞다.
- A21: 컬렉션·모델·cosine 설정 기록 + 운영 metadata 미확인 명시 (이 문서 2·3절을 옮긴다).
- A22~A23: 질의 12~20개 평가셋으로 임계값 비교. QA의 0.25를 일정 경로에 원래 있던 값처럼 적용하지 않는다.
