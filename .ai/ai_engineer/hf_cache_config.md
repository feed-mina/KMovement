# HuggingFace 로컬 캐시 설정

> 출처: `.ai/새로운 1.txt` (2026-05-17 추가)

---

## 환경변수 — HuggingFace 캐시 경로

| 변수명 | 값 | 용도 |
|--------|-----|------|
| `HF_HOME` | `D:/hf_cache` | sentence-transformers 모델 저장 루트 |
| `TRANSFORMERS_CACHE` | `D:/hf_cache/hub` | HuggingFace Hub 모델 캐시 경로 |

> `.env` 파일에 설정 필요. 미설정 시 기본값 `C:\Users\Samsung\.cache\huggingface` 사용.

---

## 관련 모델

`data_pipeline_scripts.md` 참조:

| 모델 | 차원 | 용도 |
|------|------|------|
| `intfloat/multilingual-e5-small` | 384차원 | POI 임베딩 (한/영/일 다국어) |

---

## 참고 — upload_to_hf.py 미실행 상태

`src/api/upload_to_hf.py`: 아직 실행된 적 없음 (`__pycache__` 없음 확인).  
실행 방법:

```bash
python src/api/upload_to_hf.py --repo YOUR_HF_USERNAME/kride-models
```

HF 토큰 필요 (`huggingface-cli login` 선행 필요).
