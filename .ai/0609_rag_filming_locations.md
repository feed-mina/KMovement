# 아티스트 → 촬영지/성지 매핑 RAG 문서 (ennoia RAG grounding)

> 작성: 2026-06-09 / 연계: [0609_ennoia_prompts.md](0609_ennoia_prompts.md) 노드 [7] `{{rag_filming}}`
> 역할: 일정 생성 LLM이 **장소를 지어내지 않도록** 묶어주는 grounding 소스.
> LLM은 이 문서 + KTO API 응답 안의 장소만 사용 → 환각 방지의 1차 방어선.

---

## 0. ennoia RAG 사용 방식

- 이 문서를 ennoia **지식(RAG)** 으로 업로드 → 일정 워크플로우에서 `${artist}`(+`${region}`)로 검색 → 상위 청크를 LLM 노드 [7]에 `{{rag_filming}}`로 주입.
- **청킹 규칙**: **1 장소 = 1 청크**. 각 청크 맨 앞에 `아티스트 | 지역 | 장소명`을 넣어 검색 적중률↑.
- LLM에는 청크의 `place_name / lat / lng / context`만 근거로 쓰게 하고, `검증상태=확인`인 항목 우선 사용하도록 노드 [7] 프롬프트가 지시.

---

## 1. 엔트리 스키마 (한 장소당)

| 필드 | 필수 | 설명 |
|------|:---:|------|
| `artist` | ✅ | 아티스트명 (영문 표기 통일, 예: BTS, NewJeans) |
| `region` | ✅ | 시/도 (예: 서울, 부산, 제주) — `${region}` 매칭용 |
| `place_name` | ✅ | 장소명 (KTO `title`과 가능한 일치) |
| `kto_keyword` | ✅ | KTO `searchKeyword2`로 교차검증할 검색어 |
| `lat` / `lng` | ○ | 좌표 (KTO `mapy`/`mapx`로 보강 가능) |
| `relation_type` | ✅ | `MV촬영` `앨범자켓` `예능촬영` `콘서트장` `멤버언급` `팬성지` `광고촬영` |
| `context` | ✅ | 한 문장 근거 (LLM `artist_reason`에 사용) |
| `source` | ✅ | 출처 (공식 MV/방송/공식 SNS/언론기사 URL 등) |
| `verify` | ✅ | `확인`(출처 명확) / `검증필요`(미확인) |

> ⚠️ `verify=검증필요` 항목은 발표·소개서에서 단정하지 말 것. KTO API로 장소 실재만 확인되면 "ㅇㅇ와 관련 있다고 알려진"으로 톤다운.

---

## 2. 엔트리 작성 양식 (RAG 청크 — 이 블록 단위로 복제)

```
[아티스트 | 지역 | 장소명]
artist: BTS
region: 서울
place_name: (장소명)
kto_keyword: (KTO 검색어)
lat: 37.xxxxx
lng: 126.xxxxx
relation_type: MV촬영
context: (이 장소가 BTS와 어떻게 연결되는지 한 문장)
source: (공식/언론 URL)
verify: 검증필요
```

---

## 3. 예시 엔트리 (※ 양식 시연용 — 실제 제출 전 `source`/`verify` 채울 것)

> 아래는 **구조 예시**입니다. 고유 촬영지 주장은 반드시 공식 출처로 검증 후 `verify: 확인`으로 바꾸세요.
> 검증 전에는 KTO API로 "장소 실재 + 관광지 여부"만 확인된 안전한 관광지를 fallback으로 사용.

```
[BTS | 서울 | 경복궁]
artist: BTS
region: 서울
place_name: 경복궁
kto_keyword: 경복궁
lat: 37.57961
lng: 126.97704
relation_type: 팬성지
context: 한복·전통 콘셉트와 연결지어 팬들이 즐겨 찾는 서울 대표 K-컬처 성지.
source: (검증 후 기입)
verify: 검증필요
```

```
[BTS | 강원 | 주문진 방파제(향호해변 인근 버스정류장)]
artist: BTS
region: 강원
place_name: 주문진 방파제 버스정류장
kto_keyword: 주문진 방파제
lat: 37.90xxx
lng: 128.83xxx
relation_type: 앨범자켓
context: 앨범 비주얼 촬영지로 알려져 팬들의 인증샷 성지가 된 강릉 주문진 해변 포인트.
source: (검증 후 기입)
verify: 검증필요
```

```
[일반 | 제주 | (성지 미확정 시 fallback)]
artist: (해당 없음 — 목적/지역 기반 대체)
region: 제주
place_name: (KTO areaBasedList2 상위 관광지)
kto_keyword: (KTO title)
relation_type: 팬성지
context: 성지 데이터가 없을 때 ${purpose}/${region} 기반 KTO 인기 관광지로 대체.
source: KTO areaBasedList2
verify: 확인
```

---

## 4. 우선 채울 아티스트 (다국어 토글 데모 기준)

내일 데모는 ko+en 2종 + 인기 아티스트 1~3팀이면 충분. 권장 우선순위:

1. **BTS** — 인지도·촬영지/성지 자료 가장 풍부 → 데모 메인
2. **BLACKPINK** 또는 **NewJeans** — 글로벌 팬덤, 영문 데모 어필
3. (여유 시) `${region}` 다양화용 1팀 더

> 팀당 `verify=확인` 3~5개 장소면 일정 생성 품질 충분. 나머지는 KTO API fallback이 메움.

---

## 5. 환각 방지 2중 체크 (노드 [7] 연계)

1. **1차 (RAG)**: LLM은 이 문서 청크의 장소만 후보로 사용.
2. **2차 (API 교차검증)**: 후보 `kto_keyword`를 `searchKeyword2`로 조회 → `contentid`/좌표 실재 확인 → 없으면 드롭.
3. 둘 다 통과한 장소만 일정에 포함. `verify=검증필요`인데 2차도 실패하면 **목적·지역 기반 KTO 인기 관광지로 대체**.

> 이 2중 구조 자체가 심사 '실현가능성(프롬프트 체계성)' 어필 포인트 → 소개서 §9 시행착오에 기술.
