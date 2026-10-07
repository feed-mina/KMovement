# 동일 장소·공식 출처·다국어 교차표 검수 명세

> 현재: 2단계 전량 분류 완료, 사실 검수는 일부 완료. 검색·운영 변경 없음.

## 1. 입력 고정과 원본 보존

입력은 kride_graph.json의 POI 40,664행이다. 원본 graph SHA256 49110f8c6074a1028f687c448d1dda745ed313f5ec94e99d9cfd6af59547903c 를 사전·사후 확인했다. 기존 보존 manifest와 Chroma 원본54파일 및 압축 백업 해시가 일치했다. Chroma client·모델·검색·SQL migration은 실행하지 않았다. 별도 source-linkage-20261007 폴더에 sidecar 대장만 생성했다. 안정된 파일 해시는 실행 중인 DB의 완전한 snapshot 증명이 아니다.

## 2. 중복 분류 규칙과 동일성 한계

rules-v1.json: name/address strip·casefold·공백 축약 후 정확 일치. 빈 값 및 nan/none/null 문자열을 누락으로 처리한다. 3,313그룹/7,216행이며 각 그룹 모든 좌표쌍의 최대 Haversine 거리를 계산했다. <0.01m214, 그 외≤100m2,798, >100m301그룹. 이는 triage일 뿐 physicalIdentity의 자동 승인 규칙이 아니다. 괄호 주소 보충어 제거는 다국어 교차표의 도로명 대조에만 적용했다. 같은 건물의 전시공간·문·공원은 전체 시설에 자동 병합하지 않는다.

## 3. 공식 CSV의 행 단위 추적

공식 원본은 data.go.kr/data/15111405/fileData.do의 한국문화정보원 미디어콘텐츠 영상 촬영지 데이터다. 다운로드 CP949 CSV15,034행, SHA256 1eba00010a3274e58a302d3dfdf0b7e56b4d7af3fe03680edfeae9866845ce3c. 원본 name/address 정규화 정확 일치로 legacy1,709행 연결. 각 대응 CSV record/연번/최종작성일/좌표를 모두 보존했다. 모든 대응좌표와의 거리가≤100m인1,667행과 나머지42행을 구분했다. 레코드 단위 일치는 공식 entity ID 일치나 현장 확인이 아니다. 최신 영업·가격·artist proof는 unknown.

## 4. 다국어 근거 재사용과 독립 검수

catalog-11-v1.json SHA256 1789273e4216461313320bfb24576e40303e0b3970e1256fa6a7e1ceab6c067d 및 참조 공식 파일18개의 SHA를 다시 확인했다. 기존 검수 근거를 재사용했으며 웹페이지 현재 상태를 전부 재조회한 것은 아니다. 이름 정확 일치+괄호 보충어 제거 후 도로주소 일치로5legacy행→4시설을 연결했다. 명칭별 sourceUrl/sourceSha256/PDF page/locator를 multilingual-crosswalk.json에 보존했다. 독립 AI 검수자는 5행→4시설 identity crosswalk를 승인했다. 좌표42행 보류와 중복3,313그룹 분류도 재계산일치했으며 42행 거리 범위는100.502~4,702.742m이다. 개별 중복3,313그룹의 동일성 승인과 공개 승인은 아니다. 상세 근거는 independent-review.json이다. 기존 catalog11 전체가 legacy11장소에 연결됐다는 뜻이 아니다.

## 5. 주소·좌표 보완 계약

address-coordinate-review-local.jsonl: 주소누락1,382, 한국box밖202, 공식좌표차이/유효성검토42, 합집합1,472행. box는 lat33..39/lon124..132의 조사 기준이다. original 값과 proposedOfficialRows를 분리하고 overwrite하지 않는다. sourceLinkedUnion1,712 / remaining38,952. 가격·artist·공개 적합성은 벡터 및 명칭 근거와 독립 판정한다. 모든 publicEligible=false, automaticMerges=0.

## 6. 검증·남은 일·실행 경계

전량 ID대장40,664행, duplicate3,313그룹, 보완queue1,472행과 source/catalog/file 해시를 검증했다. 다음 검수자는 좌표충돌301그룹과 공식자료대조42행을 우선 검토하고, 나머지 장소를 제공자 원래 ID로 연결할 근거를 확보한다. poi_숫자를 임의의 외부 content ID로 간주하지 않는다. 영어·일본어 공식 별칭이 없으면 unknown. 신규 검색·색인·운영 전환은 이번 실행 범위가 아니며 검수 통과 기록만 추후 별도 후보가 될 수 있다.

공식 자료: [공공데이터포털 촬영지 자료](https://www.data.go.kr/data/15111405/fileData.do). 기존 다국어 출처와 개별 위치는 multilingual-crosswalk.json에 기록했습니다. 독립 검수 판정은 independent-review.json을 참조합니다.
