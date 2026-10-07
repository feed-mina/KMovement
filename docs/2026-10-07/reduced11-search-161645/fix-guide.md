# 11곳·51문항 동결 / 검색 실행 근거 / 미완료 공개 gate

## 고정한 범위
카탈로그11개는 이름·주소·공식 게시 좌표·서울 지역·ko/en/ja 표기 승인 범위다. 가격·아티스트는unknown이며 현장 출입구 정확성·영업정보 승인이 아니다. 과거 유한120개 장소군 대조에서 중첩과 관련 시설군을 보수적으로 제외했다. 모든 역사적 노출에 대한 비오염 증명이 아니다.

문항은 언어별 양성11+속성근거없음6, 총51/번역군17이다. 기존20/120은 불변이다. 질문·정답 원문은 별도 담당만 보관했다. 같은 머신 폴더 분리는 OS 접근통제가 아닌 절차적 역할 분리다.

- 카탈로그 SHA256: `1789273e4216461313320bfb24576e40303e0b3970e1256fa6a7e1ceab6c067d`
- 출처 승인 SHA256: `2fe5d1eba5b0551f5fcd3439735d04b286ed057188cf9c4a15b2acc4abc988ae`
- 질문 SHA256: `2ba963b791b7db34a73f6fd4219ff6f50d00023511b2f461d11e63f3f7f2469c`
- 정답 SHA256: `b63c994e8f962f46f9560cfbee2424d2e16e5e34becd72ef0207f702c7dcc97c`
- 문항/정답/범위 manifest: `f15129b6f8c4eccd6dd8ddf373e9a7d30244205286ada29be3d35946c15f84f7`
- 실행 lock: `938ed3f5ebf19415db6ad247a46162a6e009a6bee85e5852a5d7740f1213b49e`

## 코드·환경·경계
CPU image `ghcr.io/feed-mina/kmovement-cpu@sha256:37359dcbce2fb3cfc1d73e504782c0d09af986dbc113662ba79763c233451d32`를 고정했다. 기존 운영 컨테이너 교체 없이 별도 컨테이너에서 사용했다. 모델 revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`, 모델10파일·환경52,697파일 실제 SHA 목록을 보관했다. 전체 runtime manifest hash는 `31b63e4b3fe00ff51c1012de7da7aa824f5ba939af93d9a57b287d55ecfcf2a5`다.

새 전용 입력·검사 폴더와 모델만 읽기전용 mount. 원본/운영DB·인증정보·Docker socket 미연결. network none, UID65532, cap drop ALL, no-new-privileges, seccomp, readonly root, CPU1·4GiB swap0·pids128, 출력256MiB·tmp128MiB tmpfs,600초 timeout. 준비 probe 및 실행 inspect를 각각 기록했다.

첫 준비 컨테이너는 local 로그 압축과 max-file1 조합 때문에 시작 실패했다. compress=false로 새 준비 컨테이너를 만들었고 검색 전 경계 확인을 통과했다. 그 실패는 질문이나 모델 점수와 관계없다.

실행 코드 독립 검수에서 필수 해시 누락·import 전 검증·최적화 모드 assert 무효화·비정상 종료 성공 오인 차단을 보완했다. runner/launcher SHA와 검수 SHA를 고정한 뒤 최초 검색 실행했다. 문항·프롬프트·임계값은 점수를 보고 조정하지 않았다.

## 실행 및 지표
문서는 production document_text의 passage: + 세 언어 이름/주소/지역을 사용했다. A 원문 질문과 B query: 접두사는 같은 저장 벡터를 고정했다. P 공식 이름 우선순위는 별도이며 C 문서형식 비교는 하지 않았다. float32/384/유한값/norm≤1e-5 검사, cosine exact와ANN 비교, 동점 ID 정렬을 고정했다.

양성Recall@5/nDCG@10 분모는 언어별11개. ANN@10 분모는 각 arm·언어별17개 질문. 한국어·일본어A/B의Recall/nDCG1.0, 영어Recall1.0·nDCG0.954545. A/B 모두ANN1.0. P 세 언어Recall/nDCG1.0. 기준 Recall≥.8/nDCG≥.7/하락≤.02/ANN≥.99 통과. 검색 동작시간 p95는 B 약0.041~0.047초, P 약0.044~0.050초다. 모델로드 포함 전체24.958초, peakRSS1,007,384KiB. 이것은 실제 사용자 첫 응답시간이나 코스완료시간이 아니다.

검색은 종료코드0·OOMfalse로 끝났고 A/B 후 벡터 SHA 불변을 확인했다. 임시 컬렉션은 출력tmpfs에만 존재하며 지속 운영 후보로 전환하지 않았다. 11후보에서ANN top10은 거의 전수이므로 생산규모 성능/일반화 증거가 아니다.

## 다음 gate: 아직 통과하지 않음
| gate | 현재 | 필요한 증거 |
|---|---|---|
| 출처 | 11곳 승인 범위 통과 | 가격/아티스트 unknown 유지, 응답/지도에서도 계약 준수 |
| 검색 | 축소 범위 통과 | 범위 확대나 코드변경 시 새 사전명세·새 시험 |
| 실제 거절/과거절 | 미실행 | 언어별 속성6 수락0, 양성11 과거절0(5% 이하면 정수상0) |
| 생성 성능 | 미실행 | 실제 first meaningful p95≤10초, course p95≤30초; cold10/warm30 제안 유지 |
| 로그인·중단·재시도 | 미실행 | 실제 브라우저/새 버전 경로에서 검증, 현재 도구 초기화 실패 |
| 공개 | 보류 | 전 항목 통과 후 exact image/collection/catalog/review/config 묶음·rollback |

운영 읽기전용 조회에서 reviewed catalog 미설정, 테스트계정1개·오늘잔여10회·예약0달러를 확인했다. 운영에 신버전검수자료가 연결됐다고 주장하지 않는다. 별도 실서비스 검증 경로를 준비해야 하며 기존 운영DB/비밀정보를 검색 컨테이너에 연결하지 않는다. 51개 실제응답은10회/일 하에서 최소6일 필요하고 취소/재시도나코스추가검사는더필요할수있다. 한도우회·자동실행예약하지 않았다.

원본DB·기존컬렉션 재색인/수정 없음. 운영 web/spring/CPU digest가 이전값으로 유지되고 healthy인 것을 확인했으나, 이는 새 기능 수용검사 증거가 아니다.
