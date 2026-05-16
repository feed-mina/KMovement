# K-Ride AI 개선 로드맵

> 작성일: 2026-05-16

---

## [P1] 즉시: RAG 파이프라인 FOCUS 연동 완성

FastAPI가 이미 추천 결과를 생성할 수 있는 상태이나, 프론트엔드가 이를 호출하지 않음.
→ `backend_engineer/plan.md` [P1] FOCUS FastAPI 연동과 병행 진행.

---

## [P2] 단기: 시각화 보고서 완성

미완료 모델 시각화 실행 (사용자 직접):
```bash
# AttractionTabNet 시각화
python src/report/report_step2_poi_tabnet.py

# POI Co-occurrence 시각화
python src/ml/visualize_poi_recommender.py
```

---

## [P3] 중기: 수도권 한정 모델 전국화

전제 조건: AI Hub 전국 여행로그 신청 및 수집

| 모델 | 현재 데이터 | 목표 |
|------|-----------|------|
| POI Co-occurrence v2 | AI Hub 수도권 21,384행 | AI Hub 전국 데이터 |
| POI 매력도 TabNet | AI Hub 수도권 | AI Hub 전국 데이터 |

전국화 진행 시 `.ai/agent.md`의 0-1 원칙 준수:
- 전국 CSV 확보 후 모델 학습
- 기존 수도권 모델은 ⚠️ 표기 유지

---

## [P4] 중기: 안전 모델 데이터 누수 해결

현재 `safety_index_v2`가 학습 피처(`width_m`, `district_danger`)에서 직접 계산됨.
→ 외부 사고 건수를 타겟으로 삼는 재설계 필요.
→ `district_danger_nationwide.csv`의 실제 사고 건수를 타겟으로 모델 재학습.

---

## [P5] 장기: 추천 모델 고도화

| 항목 | 현황 | 목표 |
|------|------|------|
| LLM | Groq API | 로컬 Ollama (llama3.1:8b) 폴백 구성 |
| 임베딩 | multilingual-e5-small | 다국어 품질 검증 후 업그레이드 검토 |
| 추천 다양성 | 단일 파이프라인 | 앙상블 (Co-occurrence + 매력도 + 벡터 유사도) |
| 예산 반영 | 현재 필터 미약 | ConsumeTabNet v3 예측값으로 POI 필터링 |

---

## 데이터 수집 잔여 항목

| 항목 | 상태 | 담당 |
|------|------|------|
| 둘레길 (두루누비 공공데이터) | ⏳ 미수집 | 사용자 직접 실행 |
| 프리미엄 맛집 (또간집) | 🔜 보류 | Kakao API 권한 해결 후 재개 |
| AI Hub 전국 여행로그 | ⏳ 미신청 | 공식 신청 절차 필요 |
