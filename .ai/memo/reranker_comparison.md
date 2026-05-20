# 리랭커 비교: MiniLM vs BGE-reranker-v2-m3

테스트 쿼리: 20개 한국어 관광 쿼리
검색 소스: ChromaDB 'kride_pdf_knowledge' (4636 chunks)

## 결과 요약

| 메트릭 | MiniLM (22M) | BGE-M3 (560M) |
|--------|-------------|---------------|
| 평균 Latency (ms) | 3523.3 | 96172.8 |
| 한국어 관련도 (0-2) | 0.00 | 0.00 |
| Top-5 Jaccard Overlap | 0.24 | — |

## 결론

**MiniLM 채택**: 한국어 관련도 유사(0.00 vs 0.00)하며 레이턴시 3523ms로 BGE(96173ms) 대비 빠름.

생성 시각: 2026-05-19 22:08:16



추가 로그 

[1/20] 제주도 자연 관광지 추천해주세요
  MiniLM: 2498.0ms, peak=0.6MB
  BGE-M3: 79839.6ms, peak=0.4MB

[2/20] 서울에서 K-pop 관련 여행지
  MiniLM: 3766.1ms, peak=0.6MB
  BGE-M3: 104997.1ms, peak=0.5MB

[3/20] 부산 해운대 근처 맛집
  MiniLM: 5754.4ms, peak=0.6MB
  BGE-M3: 114824.2ms, peak=0.5MB

[4/20] 강원도 겨울 여행 코스
  MiniLM: 2074.1ms, peak=0.5MB
  BGE-M3: 91887.4ms, peak=0.4MB

[5/20] 경주 역사 유적지 가볼 만한 곳
  MiniLM: 3611.8ms, peak=0.6MB
  BGE-M3: 95669.8ms, peak=0.4MB

[6/20] 전주 한옥마을 체험 프로그램
  MiniLM: 7685.0ms, peak=0.6MB
  BGE-M3: 97702.0ms, peak=0.4MB

[7/20] 인천 섬 여행 추천
  MiniLM: 3540.6ms, peak=0.6MB
  BGE-M3: 92200.1ms, peak=0.4MB

[8/20] 대구 근대골목 투어
  MiniLM: 2973.6ms, peak=0.5MB
  BGE-M3: 130789.5ms, peak=0.5MB

[9/20] 여수 밤바다 관광 코스
  MiniLM: 2059.8ms, peak=0.5MB
  BGE-M3: 144575.3ms, peak=0.5MB

[10/20] 속초 설악산 등산 코스
  MiniLM: 5608.7ms, peak=0.6MB
  BGE-M3: 113565.2ms, peak=0.4MB

[11/20] 가족 여행으로 좋은 농촌 체험
  MiniLM: 5065.6ms, peak=0.6MB
  BGE-M3: 100623.8ms, peak=0.4MB

[12/20] 반려동물과 함께 갈 수 있는 관광지
  MiniLM: 3030.8ms, peak=0.6MB
  BGE-M3: 87696.1ms, peak=0.5MB

[13/20] 워케이션 가능한 숙소 추천
  MiniLM: 4347.8ms, peak=0.5MB
  BGE-M3: 112765.9ms, peak=0.4MB

[14/20] 유네스코 세계유산 한국
  MiniLM: 1869.9ms, peak=0.4MB
  BGE-M3: 66284.3ms, peak=0.3MB

[15/20] 한국 로컬 푸드 트립 추천
  MiniLM: 3294.0ms, peak=0.5MB
  BGE-M3: 76400.4ms, peak=0.4MB

[16/20] 걷기 여행 좋은 길 추천
  MiniLM: 2000.7ms, peak=0.6MB
  BGE-M3: 66203.6ms, peak=0.4MB

[17/20] 봄 벚꽃 명소 추천
  MiniLM: 2068.5ms, peak=0.6MB
  BGE-M3: 90219.2ms, peak=0.5MB

[18/20] 한국 전통 시장 투어
  MiniLM: 2022.0ms, peak=0.5MB
  BGE-M3: 79905.0ms, peak=0.4MB

[19/20] 서울 예술 투어 코스
  MiniLM: 5147.8ms, peak=0.6MB
  BGE-M3: 94601.7ms, peak=0.4MB

[20/20] 무장애 관광지 추천
  BGE-M3: 90219.2ms, peak=0.5MB

[18/20] 한국 전통 시장 투어
  MiniLM: 2022.0ms, peak=0.5MB
  BGE-M3: 79905.0ms, peak=0.4MB

[19/20] 서울 예술 투어 코스
  MiniLM: 5147.8ms, peak=0.6MB
  BGE-M3: 94601.7ms, peak=0.4MB

[20/20] 무장애 관광지 추천
  BGE-M3: 79905.0ms, peak=0.4MB

[19/20] 서울 예술 투어 코스
  MiniLM: 5147.8ms, peak=0.6MB
  BGE-M3: 94601.7ms, peak=0.4MB

[20/20] 무장애 관광지 추천
  MiniLM: 5147.8ms, peak=0.6MB
  BGE-M3: 94601.7ms, peak=0.4MB

[20/20] 무장애 관광지 추천

[20/20] 무장애 관광지 추천
[20/20] 무장애 관광지 추천
  MiniLM: 2047.4ms, peak=0.6MB
  BGE-M3: 82704.9ms, peak=0.4MB
