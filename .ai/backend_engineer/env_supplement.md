# 환경변수 보충 (db_schema_reference.md 누락분)

> 출처: `.ai/새로운 1.txt` (2026-05-17 추가)
> 실제 키 값은 `.ai/Neo4j-e6e5a79c-Created-2026-05-05_kride.txt` 및 `.env` 파일 참조.

---

## 1. NEO4J_USERNAME 정정

> **주의**: `db_schema_reference.md`에는 `NEO4J_USERNAME=neo4j`로 기록되어 있으나
> 실제 AuraDB 인스턴스의 username은 **인스턴스 ID** 값임.

| 변수명 | 실제값 | 비고 |
|--------|--------|------|
| `NEO4J_URI` | `neo4j+s://e6e5a79c.databases.neo4j.io` | 기존과 동일 |
| `NEO4J_USERNAME` | `e6e5a79c` | ⚠️ 기존 문서의 `neo4j`는 오기 |
| `NEO4J_DATABASE` | `e6e5a79c` | USERNAME과 동일 (AuraDB 규칙) |
| `NEO4J_PASSWORD` | `.ai/Neo4j-*.txt` 참조 | 여기에 기록하지 않음 |

---

## 2. Supabase 환경변수 (신규)

> `db_schema_reference.md` 미수록 항목

| 변수명 | 용도 |
|--------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_KEY` | Supabase anon public key (대시보드 → Settings → API) |

**현재 상태**: `.env`에 placeholder 값 (`<project-ref>`, `<anon-public-key>`)만 존재 — 실제 Supabase 프로젝트 연결 미완료.

> Supabase는 PostgreSQL 통합 대안으로 검토 중 (현재 PG16 로컬 사용 중).
> `architect/phase_completion.md` 의 "DB 파편화 해소" 개선 방향 항목 참조.
