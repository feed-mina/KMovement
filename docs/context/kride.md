kride

 # --- Firebase --- (기존 유지)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB3P8KTUQ6CTziP0cmnyH64TCcD4N-rLI8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=krider-8186e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://krider-8186e-default-rtdb.firebaseio.com/
NEXT_PUBLIC_FIREBASE_PROJECT_ID=krider-8186e
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=krider-8186e.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=455700419792
NEXT_PUBLIC_FIREBASE_APP_ID=1:455700419792:web:42d756588879e5133abad5

# --- NextAuth ---
NEXT_PUBLIC_NEXTAUTH_SECRET=4UafVND4BX64GXFEbcn/0lztqxggNh7axbTeA2xjsIE=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=455700419792-cbnmo5r54h2l4j2temoufelq16e1ib9e.apps.googleusercontent.com
# 아래 비밀번호 부분에 섞여 들어간 URL을 제거했습니다. 실제 보안 비밀번호만 남기세요.
NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=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
NEXT_PUBLIC_GITHUB_ID=Iv23liNmxKVFw7GZlPA1
NEXT_PUBLIC_GITHUB_SECRET=5b45c4a61cc099ded22f399f4f3660476e83263c

# --- TMDB API Config ---
# 코드에서 NEXT_PUBLIC_TMDB_API_KEY를 쓰므로 이름을 맞춥니다.
NEXT_PUBLIC_TMDB_API_KEY=ddeda9bd60ef8f608826228f0d611390
# confirmToken 함수에서 사용하는 TMDB 계정 정보 (실제 TMDB 아이디/비번 입력 필요)
NEXT_PUBLIC_TMDB_USERNAME=feedMina
NEXT_PUBLIC_TMDB_PASSWORD=ExnMm$!p7Y*Nqv!
# 긴 토큰이 필요하다면 아래에 별도 저장
NEXT_PUBLIC_TMDB_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkZGVkYTliZDYwZWY4ZjYwODgyNjIyOGYwZDYxMTM5MCIsIm5iZiI6MTc3NzkwMjAwOC4yNDgsInN1YiI6IjY5ZjhhMWI4ZGE4ZTY3NTY4NTMyNzFmOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VoKE5pJ-Hu-H0_eBV4GpSpdZGANTQdMk9yF11QP456A

# --- Neo4j AuraDB Config ---
# usename e6e5a79c
NEO4J_URI=neo4j+s://e6e5a79c.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=S31NVMejWZ5HjPVfg8eFdbe5a20oA2CVHF9ssTkjkVU

import os
os.environ["OPENAI_API_KEY"] = "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"

  
  MATCH (n) RETURN n;

Aura DB ID
neo4j
Aura DB 비밀번호 
2ed0PYR5FlvzzhdLmNzG_bV1h2aXzo3p7WDvTzA6mAQ

db 인스턴스 id
9ce12743

db 인스턴스 pw 
wPN_2vyvYgyNscYxgxLsGuDdzavwndkV4KZblUAJSyQ
 

Neo4j로 옮기더라도 Firebase의 모든 것을 버릴 필요는 없습니다. 비용 효율적인 하이브리드 전략을 추천합니다.
인증(Login): 계속 Firebase Auth를 쓰세요. (따라서 API_KEY, AUTH_DOMAIN 등은 그대로 둡니다.)
이미지 저장: 계속 Firebase Storage를 쓰세요. (따라서 STORAGE_BUCKET 등도 그대로 둡니다.)
비즈니스 데이터(영화, 인맥, 추천): 이 부분만 Neo4j로 관리합니다.
즉, .env 파일은 이런 모습이 됩니다:
# 1. 인증 및 파일 저장용 (기존 유지)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... (기존 Firebase 설정들)
스타트업은 로그인과 파일 업로드는 이미 잘 되어 있는 Firebase를 그대로 쓰고, 복잡한 영화/사용자 관계 쿼리만 Neo4j에 맡기는 것이 개발 속도와 비용 관리 측면에서 가장 효율적
# 2. 핵심 관계형 데이터용 (Neo4j 추가) - NEXT_PUBLIC을 붙이지 않음!
NEO4J_URI=neo4j+s://...
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...

npm install neo4j-driver
import neo4j from 'neo4j-driver'

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
)

supabase db pw
supabase123!



-------------------------------------------------------------

Graph 구조 데이터 (NetworkX 기반)
DB의 데이터를 그래프 구조로 변환하여 파일 형태로 저장한 것입니다. GraphRAG 알고리즘이 직접 참조하는 데이터입니다.

파일 위치:
models/kride_graph.graphml: 그래프 전문 시각화 도구(Gephi, Cytoscape 등)에서 열어 노드와 엣지의 연결 상태를 직접 볼 수 있습니다.
models/kride_graph.json: 텍스트 에디터나 브라우저에서 구조를 확인할 수 있으며, 노드의 속성(커뮤니티 번호 등)이 포함되어 있습니다.

ChromaDB (벡터 데이터베이스)
RAG 시스템에서 '의미 기반 검색'을 수행하기 위해 POI 설명을 수치화(Embedding)하여 저장한 데이터베이스입니다.

저장 위치: 프로젝트 루트의 chroma_db/ 폴더
확인 방법: 일반적인 뷰어로는 볼 수 없으며, Python 코드를 통해 컬렉션 목록과 저장된 문서를 확인해야 합니다.

현재 구축된 RAG 및 GraphRAG 데이터의 통합 요약 현황은 다음과 같습니다.
GraphRAG (지식 그래프) 구축 현황
전체 POI와 아티스트(드라마) 간의 관계를 구조화한 결과입니다.
전체 노드 수: 39,109개
POI 노드: 39,089개 (관광지, 촬영지 등)
아티스트 노드: 20개 (드라마/가수 등)
전체 관계(엣지) 수: 175개 (FILMING_AT 관계)
커뮤니티 탐색: 38,934개의 그룹으로 분류 (대부분 독립된 장소들이며, 드라마와 연결된 장소들이 핵심 커뮤니티를 형성)
2. 관계형 데이터베이스 (PostgreSQL) 현황
실제 DB에 적재된 로우 데이터 통계입니다.
등록 아티스트: 20명
아티스트-POI 연결 수: 178개 (일부 장소가 여러 드라마에 출연한 경우 포함)
POI 카테고리별 데이터:
음식점(food): 813,631건 (방대한 맛집 데이터 확보)
K-Culture(kculture): 23,184건 (촬영지 및 성지 데이터)
편의시설(facility): 21,645건
관광지(tourism): 15,905건
3. VectorDB (ChromaDB) 현황
현재 로컬 환경에 chromadb 라이브러리가 설치되어 있지 않아 상세 조회가 제한되나, 데이터 정제 및 임베딩 준비가 완료된 상태입니다.
💡 요약 및 인사이트
구축된 데이터는 약 87만 건의 방대한 POI 데이터를 기반으로 하며, 특히 K-Pop/K-Drama 촬영지 178곳이 아티스트 노드와 강력하게 연결되어 있습니다. 이를 통해 "특정 드라마 촬영지 근처의 맛집"이나 "좋아하는 아티스트와 관련된 장소 추천"과 같은 고차원적인 GraphRAG 질의에 대응할 준비가 되었습니다

DB 파편화 주의: 현재 [PostgreSQL + ChromaDB + Local JSON/GraphML]로 쪼개져 있는 데이터를 하나로 모으는 작업이 최우선입니다. **Supabase(PostgreSQL)**는 이 세 가지를 하나로 합칠 수 있는 유일한 대안입니다.
파일 기반 GraphRAG의 한계: 현재 models/kride_graph.json 파일을 직접 참조하고 계신데, 이는 데이터가 늘어날수록 서버 메모리 점유율을 높입니다. 이 구조를 [DB 쿼리 -> 필요한 서브 그래프 추출 -> NetworkX 계산] 방식으로 전환해야 서비스가 안정화됩니다.



현재 구축된 RAG 및 GraphRAG 데이터의 통합 요약 현황은 다음과 같습니다.

1. GraphRAG (지식 그래프) 구축 현황
전체 POI와 아티스트(드라마) 간의 관계를 구조화한 결과입니다.

전체 노드 수: 39,109개
POI 노드: 39,089개 (관광지, 촬영지 등)
아티스트 노드: 20개 (드라마/가수 등)
전체 관계(엣지) 수: 175개 (FILMING_AT 관계)
커뮤니티 탐색: 38,934개의 그룹으로 분류 (대부분 독립된 장소들이며, 드라마와 연결된 장소들이 핵심 커뮤니티를 형성)
2. 관계형 데이터베이스 (PostgreSQL) 현황
실제 DB에 적재된 로우 데이터 통계입니다.

등록 아티스트: 20명
아티스트-POI 연결 수: 178개 (일부 장소가 여러 드라마에 출연한 경우 포함)
POI 카테고리별 데이터:
음식점(food): 813,631건 (방대한 맛집 데이터 확보)
K-Culture(kculture): 23,184건 (촬영지 및 성지 데이터)
편의시설(facility): 21,645건
관광지(tourism): 15,905건
3. VectorDB (ChromaDB) 현황
현재 로컬 환경에 chromadb 라이브러리가 설치되어 있지 않아 상세 조회가 제한되나, 데이터 정제 및 임베딩 준비가 완료된 상태입니다.
💡 요약 및 인사이트
구축된 데이터는 약 87만 건의 방대한 POI 데이터를 기반으로 하며, 특히 K-Pop/K-Drama 촬영지 178곳이 아티스트 노드와 강력하게 연결되어 있습니다. 이를 통해 "특정 드라마 촬영지 근처의 맛집"이나 "좋아하는 아티스트와 관련된 장소 추천"과 같은 고차원적인 GraphRAG 질의에 대응할 준비가 되었습니다.

Step 1: 지식 그래프만 Neo4j AuraDB(무료)에 저장
저장 대상: 아티스트(20개), 드라마, 그리고 핵심 촬영지(K-Culture 2.3만 건).
이유: 이 데이터들은 서로 얽혀 있어 GraphRAG가 작동해야 하는 핵심 구역입니다. 노드 수가 적어 AuraDB 무료 티어에 아주 넉넉하게 들어갑니다.
효과: "드라마 '도깨비' 촬영지 근처의 촬영지" 같은 복잡한 관계 쿼리를 Neo4j의 성능으로 처리합니다.

Step 2: 대규모 POI 데이터는 Supabase/PostgreSQL에 저장
저장 대상: 81만 건의 음식점, 편의시설 등 일반 POI.
이유: 이 데이터들은 관계보다는 **"좌표 기반 검색"**이나 **"카테고리 필터링"**이 주 목적입니다. PostgreSQL(PostGIS)은 이 분야의 최강자입니다.
효과: "이 촬영지 주변 1km 이내 맛집 리스트"는 SQL로 0.01초 만에 뽑아냅니다.

Step 3: GraphRAG와 서비스 결합
사용자가 질문을 던지면 Neo4j에서 아티스트-장소 관계를 먼저 찾습니다.
찾아낸 장소의 ID나 좌표를 가지고 Supabase에서 주변 맛집이나 상세 정보를 긁어옵니다.
이 정보들을 LLM에 전달하여 최종 답변을 생성합니다.


처음 화면 , /login, /signup 은 그대로 사용 

처음 인트로에 

intro1 
당일치기, 1박 2일, 2박 3일 버튼 3개 가 뜬다  

/movies 페이지 > intro2
여기에서 좋아하는 가수/아이돌/배우 사진 넣어놓고 고르게 하기 
( 개수는 1개 이상 5개 이하, circle 버튼을 화살표 버튼으로 바꿔서 다음으로 넘어가도록 
1개 이하 클릭하면 1개 이상 골라달라고 하고, 5개 이상 클릭하며 더 클릭하지 못하도록 한다)
latest > intro3
여기에서는 서울,경기,경북,경남,전북,....,제주 등 에서 대표 지역의 사진을 넣어놓고 
어디로 여행가고 싶은지 
( 개수는 1개 이상 5개 이하, circle 버튼을 화살표 버튼으로 바꿔서 다음으로 넘어가도록 
1개 이하 클릭하면 1개 이상 골라달라고 하고, 5개 이상 클릭하며 더 클릭하지 못하도록 한다)


intro4 
검은 바탕에 여행의 목적은 ? 제목과 함께 
checkbox Select 창을 뜨게 해서 고를 수 있도록 
intro5 
내가 생각하는 여행 예산은? 에서
최소 금액 3만원부터 최대 2백만원 안에서 
고르게 할 수 있도록 
빨간색 선(?) 

이렇게 5개의 인트로를 하고 나면 
/my-list 으로 바로 간다 

my-list 페이지 예시 
 
내가 고른 intro1 ~ intro5를 보여준다 

그리고 인트로에 맞춘 유저기반 정보로 추천장소를 보여줄수 있는 

' AI기반으로 방문 경로를 추천해드려요. 
	전주 한옥마을을 추천드립니다 '

라는 문구가 뜨게 한다. 

문구를 클릭하면 focus 페이지로 이동한다

focus 페이지에는 

왼쪽에 지도가 보이고 오른쪽에는 사이드 패널로 추천 여행 경로를 정리한 일정 패키지가 보인다 

여행지 지역을 포커스한 지도와 추천 경로(노드) , 그리고 그 주변의 맛집을
보여준다. 


데이터베이스 용량: 500MB
벡터 데이터 크기: 87만 건의 POI 정보를 임베딩(예: OpenAI text-embedding-3-small, 1536차원)하면, 벡터 데이터만으로 약 5GB~6GB의 용량을 차지하게 됩니다.
결과: 무료 티어(500MB)에는 87만 건을 다 넣을 수 없습니다. 월 $25(약 3.3만 원)의 Pro 플랜으로 업그레이드가 필수적입니다.
 
                                                 최종 완료 현황                                                 
                                                                   Phase 0 (완료)                                                 
                                                                 
  Phase 1 (완료)                                                 

  - 1-1. DynamicEngine 복사 및 K-Ride 액션 적용 (완료)
  - 1-2. componentMap (완료)
  - 1-3. Zustand 온보딩 스토어 (완료)
  - 1-4. screenMap (완료)
  - 1-5. ConditionalHeader + layout.tsx (완료)

  Phase 2 (완료)

  - Level 2 Atoms 11개, Level 3 복합 6개 (완료)

  Phase 3 (완료)

  - browse / movies / latest / intro4 / intro5 (완료)

  Phase 4 (완료)

  - my-list/page.tsx — 온보딩 요약 + AI 배너, duration===null 시 
  /browse redirect (완료)
  - focus/page.tsx — 60/40 지도+일정 패널, duration===null 시    
  redirect (완료)

  Phase 5 (완료)

  - src/middleware.ts — 9개 경로 accessToken 쿠키 인증 보호      
  (완료)
  - public/manifest.json — PWA 매니페스트 (완료)
  - next.config.ts — next-pwa 조건부 적용 (완료)

  SDUI DB SQL (완료)

  - V40__kride_screens.sql — 이미 완성되어 있었음 (완료)

  Jest 테스트 (완료)

  - jest.config.ts — ts-jest, jsdom, setupFilesAfterEnv (완료)   
  - onboarding-store.test.ts — Intro1~5 + My-list 스토어 로직    
  전체 (완료)
  - ItineraryPanel.test.tsx — Focus duration별 날짜 구조 (완료)  
  - SelectionCard.test.tsx — 5개 초과 방지, 토글 해제 (완료)     
  - DualRangeSlider.test.tsx — 경계값, 슬라이더 범위 제한 (완료) 

  ---
  실행 방법

  # 의존성 설치 (jest, testing-library, next-pwa 추가됨)
  cd D:/kride-project/SDUI/kride
  npm install

  # 테스트 실행
  npm test

  # 개발 서버
  npm run dev

  주의: next-pwa는 npm install 후 NODE_ENV=production에서만      
  서비스 워커가 활성화됩니다. 개발 환경에서는 manifest.json만    
  동작하며 SW는 비활성화됩니다.







       데이터 수집 파이프라인

       - 두루누비 API + 웹 크롤링 (requests, Selenium)
       - 아이돌/배우 이미지 (DuckDuckGo)
       - POI 메타데이터 (PostgreSQL 내보내기)

       확장된 인프라

       - Neon PostgreSQL 선택지 (클라우드 배포)
       - Colab 임베딩 (GPU 활용)
       - FastAPI 서버 (src/api/)
       - Streamlit 앱 (src/app/)

       전체 프로젝트는 K-Ride 2.0 다국어 여행 AI 추천
       시스템으로, RAG + 지식그래프 + 다중 벡터DB를 통합한       
       엔터프라이즈급 구조입니다.
  ⎿  Done (24 tool uses · 81.5k tokens · 1m 15s)
  
  
  ------------------------------------------
  
       완벽합니다. 이제 최종 보고서를 작성하겠습니다.

       종합 탐색 보고서: K-Ride 프로젝트

       1. Neo4j 설정 파일
       (.ai/Neo4j-e6e5a79c-Created-2026-05-05_kride.txt)

       전체 내용:
       NEO4J_URI=neo4j+s://e6e5a79c.databases.neo4j.io
       NEO4J_USERNAME=e6e5a79c
       NEO4J_PASSWORD=S31NVMejWZ5HjPVfg8eFdbe5a20oA2CVHF9ssTk    
       jkVU
       NEO4J_DATABASE=e6e5a79c
       AURA_INSTANCEID=e6e5a79c
       AURA_INSTANCENAME=krider
       - Neo4j Aura (클라우드 환경) 인스턴스 설정
       - 2026-05-05 생성
       - krider 이름의 그래프 데이터베이스 구성

       ---
       2. ChromaDB 폴더 구조

       위치: D:/kride-project/chroma_db

       구조:
       chroma_db/
       ├── chroma.sqlite3
       └── [4개 UUID 폴더들]
           ├── bb6eff76-c6ad-4ed4-9115-736a86d8536c/
           │   ├── data_level0.bin
           │   ├── header.bin
           │   ├── index_metadata.pickle
           │   ├── length.bin
           │   └── link_lists.bin
           ├── bc46fb1b-56b4-4bab-b383-956cd92faba8/
           ├── d779f5e7-3653-4996-a086-d4b58e7e4d4c/
           └── f7a85494-ff0d-4fc4-987a-ee7c4acf7729/

       분석:
       - 4개의 HNSW 벡터 인덱스 (각각 별도 컬렉션 저장)
       - SQLite3 메타데이터 저장소
       - 로컬 벡터DB로 POI 임베딩 저장

       ---
       3. scripts/ 폴더 전체 목록 및 내용

       3-1. RAG 파이프라인 관련

       rag_groq_pipeline.py (474줄)

       - 목적: Groq API 기반 RAG 파이프라인 (응답 시간 1~2초)    
       - 핵심 구성:
         - LLM: Groq (openai/gpt-oss-120b 또는
       llama-3.3-70b-versatile)
         - Embedding: intfloat/multilingual-e5-small (다국어     
       지원)
         - VectorDB: ChromaDB (코사인 유사도)
         - 추적: MLflow
       - 주요 기능:
         - 10개 샘플 POI로 ChromaDB 컬렉션 생성
         - 다국어(한/영/일) 임베딩 유사도 테스트
         - RAG 기반 한국 여행 추천
         - 벡터 검색 평가 (Recall@1, avg_similarity)
       - 실행: python scripts/rag_groq_pipeline.py
       - MLflow 추적: SQLite 백엔드 사용

       rag_pgvector_pipeline.py (407줄)

       - 목적: PostgreSQL pgvector 기반 RAG (874K POI 전체       
       인덱싱)
       - 핵심 구성:
         - LLM: Groq (openai/gpt-oss-120b)
         - Embedding: intfloat/multilingual-e5-small
         - VectorDB: PostgreSQL pgvector + IVFFlat 인덱스        
         - 추적: MLflow
       - 주요 특징:
         - 전체 POI 874K개 벡터 검색
         - pgvector 연산자 사용 (embedding <=> vector)
         - 벡터 검색 평가 (평균 유사도, 검색 시간)
       - 매개변수:
         - TOP_K = 5
         - 다국어 유사도 측정

       setup_pgvector.py (52줄)

       - 목적: PostgreSQL에 pgvector 확장 활성화
       - 작업:
         - vector extension 생성
         - poi 테이블에 embedding(vector(384)) 컬럼 추가
         - 임베딩 상태 확인 (있음/없음 통계)
       - 선제 조건: load_pgvector_from_colab.py 실행 필요        

       load_chroma_from_colab.py (127줄)

       - 목적: Colab 임베딩 결과 → 로컬 ChromaDB 로드
       - 입력:
         - data/poi_embeddings.npy (Colab 생성)
         - data/poi_metadata.parquet (Colab 생성)
       - 동작:
         - 배치 삽입 (1,000개씩)
         - ChromaDB 컬렉션 'kride_poi_full' 생성
         - 검색 테스트 (BTS, 전통시장 등)

       load_pgvector_from_colab.py (152줄)

       - 목적: Colab 임베딩 결과 → PostgreSQL pgvector 로드      
       - 입력: 동일 (poi_embeddings.npy,
       poi_metadata.parquet)
       - 동작:
         - pgvector 문자열 포맷으로 변환
         - poi 테이블에 embedding 컬럼 업데이트 (배치)
         - IVFFlat 인덱스 생성 (검색 가속)
         - 검색 테스트
       - 로드 시간: 수분 소요

       ---
       3-2. 데이터 수집 스크립트

       collect_durunubi_data.py (392줄)

       - 목적: 두루누비(한국 둘레길) 데이터 수집
       - 3 Phase 구성:
         a. Phase 1: 두루누비 공공 API (routeList,
       courseList)
         b. Phase 2: durunubi.kr 웹 크롤링 (이미지)
         c. Phase 3: 데이터 병합 & JSON/CSV 저장
       - 출력 경로: e:/krider/kride-project/data/durunubi        
       - 파일 생성:
         - routes_YYYYMMDD_HHMMSS.json/csv
         - courses_YYYYMMDD_HHMMSS.json/csv
         - web_trails_YYYYMMDD_HHMMSS.json
         - collection_summary_YYYYMMDD_HHMMSS.json

       collect_durunubi_v2.py (100+ 줄, 부분 읽음)

       - 개선 사항:
         - 재시도 로직 강화 (max_retries=3)
         - 딜레이 강화 (API_DELAY=2.0초)
         - 403 에러 처리 (지수 백오프)
         - PAGE_SIZE 감소 (100 → 50)

       crawl_trail_images.py (80+ 줄, 부분 읽음)

       - 도구: Selenium WebDriver
       - 목적: 두루누비 road-walk.do에서 540개 이미지 크롤링     
       - 추출 정보:
         - 트레일 이름
         - 이미지 (src/data-src)
         - 상세 ID (onclick에서 정규식)
       - JavaScript 주입: DOM 직접 탐색

       download_celeb_images.py (80+ 줄, 부분 읽음)

       - 목적: 아이돌/배우 프로필 이미지 DuckDuckGo에서
       다운로드
       - 카테고리:
         - kpop_groups (BTS, BLACKPINK, Stray Kids 등 24개)      
         - kpop_solo (IU, Zico, Rose 등)
         - actors (Lee Min Ho, Song Hye Kyo 등)
         - content (Squid Game, The Glory 등)
       - 출력: e:/krider/kride-project/images

       ---
       3-3. 유틸리티 스크립트

       export_poi_for_colab.py (74줄)

       - 목적: PostgreSQL → CSV 내보내기 (Colab 임베딩용)        
       - 출력: data/poi_for_embedding.csv (~150MB)
       - 쿼리:
         - poi 테이블에서 12개 컬럼 추출
         - ST_Y/ST_X로 lat/lon 변환
         - 스트리밍 커서 (대용량 처리)

       test_rag_pipeline.py (502줄)

       - 목적: Ollama + RAG 파이프라인 테스트 (MLflow 추적)      
       - 8단계 구성:
         a. 패키지 설치
         b. Ollama 연결 확인 (ollama.list())
         c. LLM 기본 대화 (qwen2.5:3b)
         d. 임베딩 테스트 (intfloat/multilingual-e5-small)       
         e. ChromaDB 샘플 POI
         f. 벡터 검색 평가
         g. RAG 추천 (3개 언어)
         h. PostgreSQL 연결 테스트
       - 성능 측정:
         - Recall@1, 평균 유사도
         - 응답 시간 (이전 Ollama ~46초)

       ---
       4. notebooks/ 폴더 하위 파일 목록



       파일명: 01_ollama_rag_tutorial.ipynb
       크기: 33KB
       수정일: 4월 29
       설명: Ollama + RAG 입문 튜토리얼 (단계별 실습)
       ────────────────────────────────────────
       파일명: colab_embed_poi.py
       크기: 3B
       수정일: 4월 30
       설명: (비어있음 또는 매우 짧음)
       ────────────────────────────────────────
       파일명: neo4j_data_loader.ipynb
       크기: 15KB
       수정일: 5월 6
       설명: Neo4j 데이터 로더
       ────────────────────────────────────────
       파일명: .ipynb_checkpoints/
       크기: -
       수정일: -
       설명: Jupyter 자동 체크포인트

       01_ollama_rag_tutorial.ipynb 미리보기:
       - STEP 0: 패키지 설치 (ollama, chromadb,
       sentence-transformers, python-dotenv, psycopg2)
       - STEP 1: Ollama 연결 확인 (ollama serve 실행 필수)       
       - STEP 2+: 임베딩, ChromaDB, RAG 실습

       ---
       5. src/ 폴더에서 RAG/Neo4j/LLM 관련 파일 검색 결과        

       찾은 파일:
       - src/report/check_rag_status.py ← 유일한 RAG 상태        
       확인 파일

       check_rag_status.py 내용:
       """
       K-Ride RAG/GraphRAG Build Status Summary (No Emoji for    
        Windows Compatibility)
       """
       # 3가지 레이어 체크:
       1. GraphRAG (Knowledge Graph)
          - models/kride_graph.json 로드
          - 노드 유형: POI, Artist
          - 엣지 및 커뮤니티 계산

       2. VectorDB (ChromaDB)
          - ./chroma_db 폴더
          - 컬렉션별 임베딩 문서 수

       3. Relational DB (PostgreSQL)
          - artist 테이블
          - artist_poi 링크
          - poi 카테고리 통계

       다른 src 폴더 구조:
       - src/dl/ (딥러닝: build_weather_lstm.py,
       build_consume_model_v2.py 등)
       - src/ml/ (머신러닝: build_safety_model.py,
       build_poi_recommender_v2.py 등)
       - src/preprocessing/ (전처리)
       - src/db/ (데이터베이스)
       - src/api/ (FastAPI 서버)
       - src/app/ (Streamlit 앱)

       RAG/Neo4j 관련 파일이 매우 제한적임: 대부분의 RAG
       코드는 scripts/ 폴더에 집중

       ---
       6. .env 파일 (루트)

       위치: D:/kride-project/.env

       전체 내용:
       KMA_API_KEY=1982f962b3451ad1a449051bf6266ac560540e3466    
       78c51933ae885bc2b4a95e
       ASOS_API_KEY=http://t1.daumcdn.net/mapjsapi/bundle/pos    
       tcode/prod/postcode.v2.js982f962b3451ad1a449051bf6266a    
       c560540e346678c51933ae885bc2b4a95e
       # [Neon 배포용] DATABASE_URL=postgresql://neondb_owner    
       :npg_7rbVY1OtfAlp@...
       DATABASE_URL=postgresql://postgres:postgres1234@localh    
       ost:5434/kride
       KAKAO_REST_API_KEY=435286d5f656c30b88ef6975996eea8e       
       VWORLD_API_KEY=635AACC4-9885-311C-A0C5-D4A64E2ED023       
       JUSO_CONFIRM_KEY=devU01TX0FVVEgyMDI2MDQyNjIxNDUzMzExOD    
       AwNjg=
       NAVER_CLIENT_ID=we3a62ObrDWAKca1nxPC
       NAVER_CLIENT_SECRET=YcSofgJgLU
       NCP_CLIENT_ID=oshsl45p7x
       NCP_CLIENT_SECRET=9I3QKnL0K3t5lhHfa8GKLY9NG3Oe7Xw7jFFb    
       7zxY
       GROQ_API_KEY=gsk_QGPTQCmZXimHgHZ16OujWGdyb3FYClMIbOkxF    
       6WYwWPIvUNCUGzq

       API 구성:
       - 기상청(KMA) 날씨 API
       - 카카오맵, Naver 지도 API
       - Vworld 행정구역 API
       - NCP(네이버클라우드) 서비스
       - Groq LLM API (RAG용)
       - PostgreSQL (localhost:5434, kride DB)

       ---
       7. DB 스키마 파일 (처음 50줄)

       postgres_kride.sql

       -- PostGIS 확장 활성화 (공간 쿼리용)
       CREATE EXTENSION IF NOT EXISTS postgis;

       CREATE TABLE bicycle_paths (
           id SERIAL PRIMARY KEY,
           route_name VARCHAR(255),          -- 노선명
           province VARCHAR(50),             -- 시도명
           city_district VARCHAR(50),        -- 시군구명
           start_address TEXT,               -- 기점지번주소     
           end_address TEXT,                 -- 종점지번주소     
           start_point GEOMETRY(Point, 4326), -- 공간 데이터     
           end_point GEOMETRY(Point, 4326),
           path_length_km FLOAT,             -- 총길이(km)       
           path_width_m FLOAT,               -- 너비(m)
           path_type VARCHAR(100),           -- 종류
       (전용도로, 우선도로 등)
           management_agency VARCHAR(100),   -- 관리기관명       
           last_updated DATE                 -- 기준일자
       );

       CREATE INDEX idx_bicycle_paths_start_point ON
       bicycle_paths USING GIST (start_point);

       CREATE TABLE bicycle_routes (
           id SERIAL PRIMARY KEY,
           route_name VARCHAR(255),
           city_province VARCHAR(50),
           city_district VARCHAR(50),
           start_lat DECIMAL(10, 8),
           start_lon DECIMAL(11, 8),
           end_lat DECIMAL(10, 8),
           end_lon DECIMAL(11, 8),
           geom_start GEOMETRY(Point, 4326),
           geom_end GEOMETRY(Point, 4326),
           total_length_km FLOAT,
           road_width_m FLOAT,
           route_type VARCHAR(100),
           management_agency VARCHAR(100),
           base_date DATE
       );

       db_schema.sql (처음 50줄)

       -- ERD tool in pgAdmin 4 생성 (pgAdmin 스키마)

       CREATE TABLE IF NOT EXISTS public.artist (
           id serial NOT NULL,
           name character varying(100) NOT NULL,
           name_en character varying(100),
           category character varying(50),
           image_url character varying(500),
           created_at timestamp without time zone DEFAULT        
       now(),
           CONSTRAINT artist_pkey PRIMARY KEY (id)
       );

       CREATE TABLE IF NOT EXISTS public.artist_poi (
           artist_id integer NOT NULL,
           poi_id integer NOT NULL,
           relationship_type character varying(50) DEFAULT       
       'FILMING_AT'::character varying,
           CONSTRAINT artist_poi_pkey PRIMARY KEY (artist_id,    
        poi_id)
       );

       CREATE TABLE IF NOT EXISTS public.course_template (       
           id serial NOT NULL,
           title character varying(200),
           title_en character varying(200),
           duration_days smallint,
           category character varying(30),
           transport character varying(20),
           estimated_cost integer,
           poi_ids integer[],
           route_geom geometry(LineString,4326),
           description text,
           description_en text,
           created_at timestamp without time zone DEFAULT        
       now(),
           CONSTRAINT course_template_pkey PRIMARY KEY (id)      
       );

       CREATE TABLE IF NOT EXISTS public.district_danger (       
           id serial NOT NULL,
           sido character varying(20) NOT NULL,
           sigungu character varying(30) NOT NULL,
           crash_count integer DEFAULT 0,
           death_count integer DEFAULT 0,
           severe_count integer DEFAULT 0,
           injury_count integer DEFAULT 0,
           ...
       );

       테이블 설계:
       - artist: K-Pop, 배우 등 유명인 메타데이터
       - artist_poi: 촬영지 관계 (FILMING_AT)
       - course_template: 여행 코스 템플릿 (시간, 비용, 루트)    
       - poi: 관광지 (다국어, 카테고리, 위치)
       - district_danger: 지역별 교통사고 통계

       ---
       최종 요약: 프로젝트 기술 스택

       RAG/LLM 아키텍처


       ┌─────────┬────────────────────────┬──────────────────    
       ────┐
       │  계층   │          구성          │         파일
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ LLM     │ Groq API               │
       rag_groq_pipeline.py │
       │ 백엔드  │ (openai/gpt-oss-120b)  │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 임베딩  │ intfloat/multilingual- │ scripts/*.py
           │
       │ 모델    │ e5-small (384차원)     │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 벡터DB  │                        │
       load_chroma_from_col │
       │ (선택   │ ChromaDB (HNSW 로컬)   │ ab.py
           │
       │ 1)      │                        │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 벡터DB  │ PostgreSQL pgvector    │
       load_pgvector_from_c │
       │ (선택   │ (IVFFlat 인덱스)       │ olab.py
           │
       │ 2)      │                        │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 지식그  │ Neo4j Aura (클라우드)  │ .ai/Neo4j-*.txt      
           │
       │ 래프    │                        │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 추적/실 │ MLflow (SQLite 백엔드) │ rag_*_pipeline.py    
           │
       │ 험      │                        │
           │
       ├─────────┼────────────────────────┼──────────────────    
       ────┤
       │ 다국어  │ 한/영/일 지원          │
       test_rag_pipeline.py │
       └─────────┴────────────────────────┴──────────────────    
       ────┘












       데이터 수집 파이프라인

       - 두루누비 API + 웹 크롤링 (requests, Selenium)
       - 아이돌/배우 이미지 (DuckDuckGo)
       - POI 메타데이터 (PostgreSQL 내보내기)

       확장된 인프라

       - Neon PostgreSQL 선택지 (클라우드 배포)
       - Colab 임베딩 (GPU 활용)
       - FastAPI 서버 (src/api/)
       - Streamlit 앱 (src/app/)

       전체 프로젝트는 K-Ride 2.0 다국어 여행 AI 추천
       시스템으로, RAG + 지식그래프 + 다중 벡터DB를 통합한       
       엔터프라이즈급 구조입니다.
  ⎿  Done (24 tool uses · 81.5k tokens · 1m 15s)

─────────────────────────────────────────────────────────────────
  Showing detailed transcript · ctrl+o to toggle · ctrl+e to show
   all

  
  K-Ride FastAPI 백엔드 서버
    uvicorn kride-project.fastapi_server:app --reload --port 8000
  또는
  cd kride-project && uvicorn fastapi_server:app --reload --port 8000
  
  
  
  
  
∴ Thinking…

  Now I have a very comprehensive picture of the project. Let me 
  analyze what's been completed and what needs to be done:       

  Completed:
  - Neo4j Aura cloud DB - credentials in
  .ai/Neo4j-e6e5a79c-Created-2026-05-05_kride.txt
  - Supabase DB - (not explicitly found, but user says it's      
  complete)
  - ChromaDB - 4 collections exist in chroma_db/
  - Groq RAG pipeline - scripts/rag_groq_pipeline.py

  - pgvector pipeline - scripts/rag_pgvector_pipeline.py
  - FastAPI server - src/api/fastapi_server.py (existing
  endpoints for route/recommend/weather)

  What needs to be done (connecting FastAPI + RAG + LLM):        
  I need to build out several new FastAPI endpoints that
  integrate the RAG and LLM capabilities: endpoints for fetching 
  artist lists with images and region data for the UI pages, an  
  AI-powered itinerary generator using RAG and Groq, POI
  recommendations based on user onboarding state, and a chat     
  endpoint.

  The user is asking for a guide document that shows how to wire 
  everything together—the Neo4j and Supabase databases are       
  already set up, so I need to examine what data lives in Neo4j, 
  review the existing RAG and Groq pipeline implementations, and 
  understand the current FastAPI structure to create a clear     
  integration guide.

  Now I'm mapping out the project's current state: the FastAPI   
  server has basic endpoints for routes, recommendations, and    
  weather data, there are two RAG pipeline implementations using 
  different vector stores, Neo4j is hosted on Cloud Aura,        
  ChromaDB has four collections locally, and Supabase is
  configured but not directly visible in the codebase. The guide 
  needs to explain the overall architecture and define the new   
  endpoints the SDUI frontend will need—artist and region        
  selection endpoints, plus the itinerary and point-of-interest  
  recommendation endpoints.

  I should also verify what Supabase is actually being used for  
  since there's no explicit database configuration in the        
  environment variables, though the Next.js config references    
  Supabase Storage for image domains. The Neo4j setup appears to 
  be the primary graph database, so I need to clarify how these  
  systems integrate with the FastAPI backend. I see the user     
  wants a guide document connecting FastAPI with RAG and LLM     
  components, given that Neo4j and Supabase are already
  configured. I have enough context from the existing files to   
  write a comprehensive guide without needing to explore further.

  Now I'm mapping out the structure: the guide should document   
  the current setup (Neo4j graph database with artist-POI        
  relationships, Supabase for image storage, ChromaDB with POI   
  embeddings, Groq API for LLM, and PostgreSQL with pgvector),   
  then explain the overall architecture showing how the Next.js  
  frontend connects through FastAPI to the knowledge graph,      
  vector search, and LLM components, and finally detail the new  
  FastAPI endpoints needed to tie everything together. 이제 Neo4j
   드라이버를 설정하고 아티스트-POI 관계를 쿼리하는 방식을       
  정리해야 하고, 필요한 환경변수들(Neo4j 연결 정보, Groq API 키, 
  Supabase 자격증명)을 추가한 후 전체 실행 방법과 테스트 절차를  
  문서화할 계획이다.

  사실 사용자가 원하는 건 가이드 문서 자체이므로, 먼저 계획을    
  작성해서 승인받은 후 실제 가이드를 만들어야 한다. 가이드는     
  D:/kride-project/.ai/fastapi_rag_llm_guide.md 경로에 생성될    
  것이고, 현재 인프라 현황부터 전체 아키텍처, 신규 FastAPI       
  엔드포인트 설정까지 포함할 예정이다.

  이제 Neo4j 데이터 구조와 Supabase의 역할을 파악하기 위해       
  노트북을 확인해야 한다.

                               11:14 AM claude-sonnet-4-6        
● Neo4j 데이터 구조와 Supabase 연동 방식을 추가 확인합니다.      

● Explore(Neo4j 노트북, RAG 파이프라인 스크립트 상세 탐색)       

  
  ╭───────────────────────────────────────────────────────────────╮│ Plan to implement                                             ││                                                               ││ Plan: FastAPI + RAG + LLM 연동 가이드 문서 작성               ││                                                               ││ Context                                                       ││                                                               ││ K-Ride 프로젝트에서 SDUI 프론트엔드(Next.js 14)의 온보딩      ││ 결과(아티스트/지역/목적/예산)를                               ││ 실제 AI 추천 결과로 변환하는 백엔드 파이프라인 연동 가이드    ││ 문서를 생성한다.                                              ││                                                               ││ 현재 완료된 인프라:                                           ││ - Neo4j Aura (neo4j+s://e6e5a79c.databases.neo4j.io) — Region ││  / POI / Artist / SpendProfile / WeatherProfile 노드          ││ - Supabase — 아티스트·POI 이미지 스토리지                     ││ - ChromaDB (./chroma_db) — POI 임베딩 4개 컬렉션 (embedding:  ││ multilingual-e5-small 384차원)                                ││ - Groq API — LLM (openai/gpt-oss-120b)                        ││ - 기존 FastAPI (src/api/fastapi_server.py) —                  ││ 경로/편의시설/날씨 6개 엔드포인트                             │
│                                                               │
│ 프론트엔드가 요구하는 미구현 엔드포인트:                      │
│ - GET /api/artists → Intro2(/movies) 아티스트 목록            │
│ - GET /api/regions → Intro3(/latest) 지역 목록                │
│ - POST /api/recommend/ai → My-list(/my-list) 온보딩 기반 POI  │
│ 추천                                                          │
│ - POST /api/recommend/itinerary → Focus(/focus) AI 일정 생성  │
│                                                               │
│ ---                                                           │
│ 생성할 파일                                                   │
│                                                               │
│ 가이드 문서: D:/kride-project/.ai/fastapi_rag_llm_guide.md    │
│                                                               │
│ ---                                                           │
│ 가이드 문서 구성                                              │
│                                                               │
│ 1. 전체 아키텍처 다이어그램                                   │
│                                                               │
│ SDUI Frontend (Next.js 14)                                    │
│    └─ POST /api/recommend/itinerary {duration, artists,       │
│ regions, purposes, budget}                                    │
│          │                                                    │
│          ▼                                                    │
│ FastAPI Server (src/api/fastapi_server.py)                    │
│    ├─ Neo4j Driver   → Artist-POI 그래프 쿼리 (FILMING_AT,    │
│ IN_REGION)                                                    │
│    ├─ ChromaDB       → POI 벡터 검색 (multilingual-e5-small)  │
│    ├─ Groq LLM       → 일정 텍스트 생성 (gpt-oss-120b)        │
│    └─ PostgreSQL     → POI 상세 메타데이터 조회               │
│                                                               │
│ 2. 환경변수 추가 목록 (.env에 추가)                           │
│                                                               │
│ ┌────────────┬─────────────┬──────────────────────────────┐   │
│ │   변수명   │   값 출처   │             설명             │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ NEO4J_URI  │ .ai/Neo4j-* │ neo4j+s://e6e5a79c.databases │   │
│ │            │ .txt        │ .neo4j.io                    │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ NEO4J_USER │ 동일        │ e6e5a79c                     │   │
│ │ NAME       │             │                              │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ NEO4J_PASS │ 동일        │ S31NVMej...                  │   │
│ │ WORD       │             │                              │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ NEO4J_DATA │ 동일        │ e6e5a79c                     │   │
│ │ BASE       │             │                              │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ SUPABASE_U │ Supabase    │ 이미지 스토리지 URL          │   │
│ │ RL         │ 대시보드    │                              │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ SUPABASE_K │ Supabase    │ anon public key              │   │
│ │ EY         │ 대시보드    │                              │   │
│ ├────────────┼─────────────┼──────────────────────────────┤   │
│ │ GROQ_API_K │ 이미 .env에 │ —                            │   │
│ │ EY         │  존재       │                              │   │
│ └────────────┴─────────────┴──────────────────────────────┘   │
│                                                               │
│ 3. 필수 패키지 (pip install)                                  │
│                                                               │
│ neo4j                     # Neo4j Python 드라이버             │
│ chromadb                  # 벡터 DB 클라이언트                │
│ sentence-transformers     # multilingual-e5-small 임베딩      │
│ groq                      # Groq Python SDK                   │
│ supabase                  # Supabase 클라이언트 (Full DB:     │
│ artist/poi 테이블 포함)                                       │
│ python-dotenv             # 이미 설치됨                       │
│                                                               │
│ 4. 신규 모듈 구조 (src/api/ 추가)                             │
│                                                               │
│ src/api/                                                      │
│ ├── fastapi_server.py      ← 기존 (6 엔드포인트) + 신규 4     │
│ 엔드포인트 추가                                               │
│ ├── neo4j_client.py        ← Neo4j 드라이버 + Cypher 헬퍼     │
│ (완성 코드)                                                   │
│ ├── rag_client.py          ← ChromaDB + Groq RAG 파이프라인   │
│ (완성 코드)                                                   │
│ └── supabase_client.py     ← Supabase Full DB 클라이언트      │
│ (artist/poi 테이블 조회 + 이미지 URL)                         │
│                                                               │
│ Supabase 역할 (Full DB):                                      │
│ - artist 테이블: 아티스트 이름, 이미지URL, 카테고리           │
│ - poi 테이블: 관광지 상세 정보, 이미지URL                     │
│ - artist_poi 테이블: 아티스트-촬영지 관계                     │
│ - course_template 테이블: 코스 템플릿                         │
│ - Supabase Storage: 이미지 파일 호스팅                        │
│                                                               │
│ 5. 신규 엔드포인트 상세 설계                                  │
│                                                               │
│ GET /api/artists                                              │
│                                                               │
│ - 소스: Supabase (artist 테이블) 또는 PostgreSQL (artist      │
│ 테이블)                                                       │
│ - 응답: [{id, name, imageUrl}]                                │
│ - 로직: artist 테이블 SELECT → Supabase Storage URL 조합      │
│                                                               │
│ GET /api/regions                                              │
│                                                               │
│ - 소스: Neo4j (Region 노드) 또는 하드코딩 9개 광역시도        │
│ - 응답: [{id, name, imageUrl}]                                │
│ - 로직: MATCH (r:Region) RETURN r.name, r.safety_score ORDER  │
│ BY r.safety_score DESC LIMIT 20                               │
│                                                               │
│ POST /api/recommend/ai                                        │
│                                                               │
│ - 입력: {artists[], regions[], purposes[], budget{min,max}}   │
│ - 파이프라인:                                                 │
│   a. Neo4j → 선택 아티스트의 FILMING_AT POI 조회              │
│   b. ChromaDB → purposes 기반 유사 POI 검색                   │
│   c. PostgreSQL → budget 필터링                               │
│   d. Groq → 추천 이유 텍스트 생성                             │
│ - 응답: {pois[], recommendation_text, score}                  │
│                                                               │
│ POST /api/recommend/itinerary                                 │
│                                                               │
│ - 입력: {duration, artists[], regions[], purposes[],          │
│ budget{min,max}}                                              │
│ - 파이프라인:                                                 │
│   a. Neo4j → 아티스트-POI 관계 그래프 탐색                    │
│   b. Neo4j → Region 안전점수/날씨/소비 프로파일 조회          │
│   c. ChromaDB → 목적별 POI 벡터 검색                          │
│   d. Groq → 일정 JSON 생성 (duration 별 day/morning/afternoon │
│  구조)                                                        │
│ - 응답: {itinerary: [{morning: {places[]}, afternoon:         │
│ {places[]}}], mapData: {markers[]}}                           │
│                                                               │
│ 6. Groq 프롬프트 구조 (일정 생성)                             │
│                                                               │
│ 시스템: 한국 여행 전문 AI. 검색된 POI 목록만 사용해 JSON      │
│ 일정을 생성하라.                                              │
│ 유저:                                                         │
│   - 여행기간: {duration}                                      │
│   - 선택아티스트: {artists}                                   │
│   - 선택지역: {regions}                                       │
│   - 여행목적: {purposes}                                      │
│   - 예산: {budget}                                            │
│                                                               │
│   아래 POI 목록만 참고하라:                                   │
│   {neo4j + chromadb 검색 결과}                                │
│                                                               │
│   출력 형식 (JSON):                                           │
│   { "itinerary": [{"morning": {"places": [...]}, "afternoon": │
│  {"places": [...]}}] }                                        │
│                                                               │
│ 7. 기존 fastapi_server.py 수정 사항                           │
│                                                               │
│ - 파일 상단 startup_event 함수에 Neo4j / ChromaDB / Groq      │
│ 클라이언트 초기화 추가                                        │
│ - 라우터 4개 추가 (artists, regions, recommend/ai,            │
│ recommend/itinerary)                                          │
│                                                               │
│ 8. 실행 순서 및 테스트                                        │
│                                                               │
│ # 1. 패키지 설치                                              │
│ pip install neo4j chromadb sentence-transformers groq         │
│ supabase                                                      │
│                                                               │
│ # 2. .env에 Neo4j + Supabase 환경변수 추가                    │
│                                                               │
│ # 3. FastAPI 서버 실행                                        │
│ uvicorn src.api.fastapi_server:app --reload --port 8000       │
│                                                               │
│ # 4. 엔드포인트 테스트 (Swagger UI)                           │
│ http://localhost:8000/docs                                    │
│                                                               │
│ # 5. SDUI 프론트엔드 연동 확인                                │
│ # .env.local:                                                 │
│ NEXT_PUBLIC_KRIDE_API_BASE=http://localhost:8000              │
│                                                               │
│ ---                                                           │
│ 파일 생성 방법                                                │
│                                                               │
│ - 단일 파일 Write:                                            │
│ D:/kride-project/.ai/fastapi_rag_llm_guide.md                 │
│ - 기존 코드 수정 없음 (가이드 문서만 생성)                    │
│                                                               │
│ 참조 파일                                                     │
│                                                               │
│ - scripts/rag_groq_pipeline.py — ChromaDB + Groq 패턴 재사용  │
│ - src/api/fastapi_server.py — 기존 리소스 로드 패턴           │
│ - notebooks/neo4j_data_loader.ipynb — Neo4j 노드/엣지 구조    │
│ - .ai/Neo4j-e6e5a79c-Created-2026-05-05_kride.txt — 접속 정보 │
│ - .env — 기존 환경변수 목록    
  
   ---                                                              가이드 문서 구성 요약
                                                                 
  ┌─────────────┬────────────────────────────────────────────┐   
  │    섹션     │                    내용                    │
  ├─────────────┼────────────────────────────────────────────┤   
  │ 1. 아키텍처 │ SDUI 프론트 → FastAPI →                    │   
  │             │ Neo4j/ChromaDB/Groq 전체 흐름도            │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 2. 환경변수 │ .env에 추가할 Neo4j/Supabase 변수 (실제 값 │   
  │             │  포함)                                     │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 3. 패키지   │ pip install neo4j chromadb                 │   
  │             │ sentence-transformers groq supabase        │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 4~7. 신규   │ neo4j_client.py, supabase_client.py,       │   
  │ 모듈        │ rag_client.py 완성 코드                    │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 8. 서버     │ fastapi_server.py에 추가할 import + 스키마 │   
  │ 수정        │  + 4개 엔드포인트 코드                     │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 9. 입출력   │ 각 엔드포인트 Request/Response JSON 예시   │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 10. 프론트  │ /movies, /latest, /focus 페이지 React      │   
  │ 연동        │ Query 교체 코드                            │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 11. 실행    │ pip install → .env 추가 → uvicorn 실행 →   │   
  │ 순서        │ curl 테스트                                │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 12.         │ 503/Neo4j/ChromaDB/Groq/CORS 오류별 해결   │   
  │ 트러블슈팅  │ 방법                                       │   
  ├─────────────┼────────────────────────────────────────────┤   
  │ 13.         │ Neo4j 데이터 없을 때 Supabase/하드코딩으로 │   
  │ Fallback    │  대체 전략                                 │   
  └─────────────┴────────────────────────────────────────────┘   

 ───────────────────╯

╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Plan to implement                                                                                                                                          │
│                                                                                                                                                            │
│ 계획: 가이드 문서 DB 업데이트 + 페이지 버그 수정 + 프론트엔드 통합 테스트                                                                                  │
│                                                                                                                                                            │
│ Context                                                                                                                                                    │
│                                                                                                                                                            │
│ K-Ride MSA 3-서비스 구조에서 DB가 4개(PostgreSQL/Neo4j/Supabase/ChromaDB)로 역할이                                                                         │
│ 분리되어 있다. 이 구조를 가이드 문서에 반영하고, pages에 존재하는 런타임 버그를                                                                            │
│ 수정한 뒤 FastAPI ↔ Next.js 통합 테스트를 작성한다.                                                                                                        │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ DB 역할 분리 (핵심 전제)                                                                                                                                   │
│                                                                                                                                                            │
│ ┌────────────┬───────────────────┬──────────────────┬─────────────────────────────────────────┐                                                            │
│ │     DB     │       위치        │    접근 주체     │                  용도                   │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ PostgreSQL │ AWS EC2           │ Spring Boot 전용 │ users, ui_metadata, query_master        │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ Neo4j Aura │ Cloud             │ FastAPI 전용     │ Region/POI/Artist 그래프                │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ Supabase   │ Cloud             │ FastAPI 전용     │ artist, poi, artist_poi 테이블 + 이미지 │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ ChromaDB   │ FastAPI 서버 로컬 │ FastAPI 전용     │ POI 임베딩 4컬렉션                      │                                                            │
│ └────────────┴───────────────────┴──────────────────┴─────────────────────────────────────────┘                                                            │
│                                                                                                                                                            │
│ Next.js(Vercel)는 DB에 직접 접근하지 않고 API만 호출한다.                                                                                                  │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 1단계: 가이드 문서 업데이트                                                                                                                                │
│                                                                                                                                                            │
│ 파일: D:/kride-project/.ai/fastapi_rag_llm_guide.md                                                                                                        │
│                                                                                                                                                            │
│ 섹션 0 (MSA 폴더 구조) 내 "각 서비스 역할 요약" 표 바로 아래에                                                                                             │
│ "DB 역할 분리" 섹션 삽입:                                                                                                                                  │
│                                                                                                                                                            │
│ ### DB 역할 분리 (혼동 금지)                                                                                                                               │
│                                                                                                                                                            │
│ | DB | 위치 | 접근 주체 | 테이블/노드 |                                                                                                                    │
│ |----|------|----------|------------|                                                                                                                      │
│ | PostgreSQL | AWS EC2 | Spring Boot 전용 | users, ui_metadata, query_master |                                                                             │
│ | Neo4j Aura | Cloud | FastAPI 전용 | Region, POI, Artist, 관계 |                                                                                          │
│ | Supabase | Cloud | FastAPI 전용 | artist, poi, artist_poi, 이미지 |                                                                                      │
│ | ChromaDB | FastAPI 서버 로컬 | FastAPI 전용 | POI 임베딩 4컬렉션 |                                                                                       │
│                                                                                                                                                            │
│ > Next.js(Vercel)는 DB에 직접 접근하지 않는다.                                                                                                             │
│ > Spring Boot가 PostgreSQL을 읽어 ui_metadata를 내려주고,                                                                                                  │
│ > FastAPI가 Neo4j/Supabase/ChromaDB를 읽어 AI 추천을 내려준다.                                                                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 2단계: 페이지 버그 수정 (통합 테스트 전제 조건)                                                                                                            │
│                                                                                                                                                            │
│ 모든 파일 경로: D:/kride-project/subproject/SDUI/kride/                                                                                                    │
│                                                                                                                                                            │
│ movies/page.tsx                                                                                                                                            │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → import { useQuery } from "@tanstack/react-query" 추가                                                                     │
│ - 버그 2: line 39 ARTIST_LIST undefined → [] 로 교체                                                                                                       │
│ - 버그 3: line 57 pageData={{ artistList: ARTIST_LIST }} → pageData={{ artistList: artistList }}                                                           │
│                                                                                                                                                            │
│ latest/page.tsx                                                                                                                                            │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → 추가                                                                                                                      │
│ - 버그 2: line 29 REGION_LIST undefined → [] 로 교체                                                                                                       │
│ - 버그 3: line 47 pageData={{ regionList: REGION_LIST }} → pageData={{ regionList: regionList }}                                                           │
│                                                                                                                                                            │
│ focus/page.tsx                                                                                                                                             │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → 추가                                                                                                                      │
│ - 버그 2: isLoading 중복 선언 → line 65 것을 isItineraryLoading, line 82 것을 isMetaLoading                                                                │
│ - 버그 3: MOCK_ITINERARY[safeDuration] undefined → data?.itinerary ?? []                                                                                   │
│ - 버그 4: MAP_MARKERS undefined → data?.mapData?.markers ?? []                                                                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 3단계: Jest 설정 보완                                                                                                                                      │
│                                                                                                                                                            │
│ 파일: D:/kride-project/subproject/SDUI/kride/jest.config.ts                                                                                                │
│                                                                                                                                                            │
│ moduleNameMapper에 추가:                                                                                                                                   │
│ "^next/navigation$": "<rootDir>/src/__tests__/__mocks__/next-navigation.ts",                                                                               │
│ "^next/dynamic$":    "<rootDir>/src/__tests__/__mocks__/next-dynamic.ts",                                                                                  │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 4단계: Mock 파일 신규 생성                                                                                                                                 │
│                                                                                                                                                            │
│ src/__tests__/__mocks__/next-navigation.ts                                                                                                                 │
│ export const useRouter = () => ({ push: jest.fn(), replace: jest.fn() });                                                                                  │
│ export const usePathname = () => "/";                                                                                                                      │
│ export const useSearchParams = () => new URLSearchParams();                                                                                                │
│                                                                                                                                                            │
│ src/__tests__/__mocks__/next-dynamic.ts                                                                                                                    │
│ const dynamic = (_fn: any, _opts?: any) => {                                                                                                               │
│   const Comp = () => null;                                                                                                                                 │
│   Comp.displayName = "DynamicMock";                                                                                                                        │
│   return Comp;                                                                                                                                             │
│ };                                                                                                                                                         │
│ export default dynamic;                                                                                                                                    │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 5단계: 통합 테스트 파일 3개 생성                                                                                                                           │
│                                                                                                                                                            │
│ 테스트 전략                                                                                                                                                │
│                                                                                                                                                            │
│ - fetch mock: jest.fn() — URL별로 분기해서 SDUI API / FastAPI 응답 구분                                                                                    │
│   - /api/ui/* → { data: [] } (SDUI 메타데이터 없음 → fallback UI)                                                                                          │
│   - */api/artists → { artists: [...] } (FastAPI)                                                                                                           │
│   - */api/regions → { regions: [...] } (FastAPI)                                                                                                           │
│   - */api/recommend/itinerary → { itinerary: [...], mapData: {...} } (FastAPI)                                                                             │
│ - QueryClientProvider 래퍼로 각 테스트 격리                                                                                                                │
│ - Zustand store: useOnboardingStore.setState() 로 초기값 설정                                                                                              │
│                                                                                                                                                            │
│ src/__tests__/integration/movies-page.test.tsx                                                                                                             │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. FastAPI /api/artists 응답 → 아티스트 이름 렌더링                                                                                                        │
│ 2. 아티스트 0개 선택 시 "다음 →" 버튼 disabled                                                                                                             │
│ 3. fetch가 올바른 FastAPI URL로 호출됨                                                                                                                     │
│                                                                                                                                                            │
│ src/__tests__/integration/latest-page.test.tsx                                                                                                             │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. FastAPI /api/regions 응답 → 지역 이름 렌더링                                                                                                            │
│ 2. 지역 0개 선택 시 "다음 →" 버튼 disabled                                                                                                                 │
│ 3. fetch가 올바른 FastAPI URL로 호출됨                                                                                                                     │
│                                                                                                                                                            │
│ src/__tests__/integration/focus-page.test.tsx                                                                                                              │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. duration=null → /browse redirect                                                                                                                        │
│ 2. isItineraryLoading=true → "일정 생성 중..." 텍스트                                                                                                      │
│ 3. FastAPI /api/recommend/itinerary 응답 → ItineraryPanel 렌더링                                                                                           │
│ 4. fetch POST body에 store 값(duration/artists/regions)이 포함됨                                                                                           │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 수정/생성 파일 목록 (총 10개)                                                                                                                              │
│                                                                                                                                                            │
│ ┌──────────────────────────────────┬───────────────────────────┬─────────────────────────────────────────────┐                                             │
│ │               파일               │           작업            │                    위치                     │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ fastapi_rag_llm_guide.md         │ DB 분리 섹션 추가         │ D:/kride-project/.ai/                       │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ movies/page.tsx                  │ 버그 3개 수정             │ subproject/SDUI/kride/src/app/(afterLogin)/ │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ latest/page.tsx                  │ 버그 3개 수정             │ 동일                                        │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ focus/page.tsx                   │ 버그 4개 수정             │ 동일                                        │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ jest.config.ts                   │ moduleNameMapper 2개 추가 │ subproject/SDUI/kride/                      │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ __mocks__/next-navigation.ts     │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ __mocks__/next-dynamic.ts        │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/movies-page.test.tsx │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/latest-page.test.tsx │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/focus-page.test.tsx  │ 신규                      │ src/__tests__/                              │                                             │
│ └──────────────────────────────────┴───────────────────────────┴─────────────────────────────────────────────┘                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 실행 검증                                                                                                                                                  │
│                                                                                                                                                            │
│ cd D:/kride-project/subproject/SDUI/kride                                                                                                                  │
│                                                                                                                                                            │
│ # 통합 테스트만 실행                                                                                                                                       │
│ npx jest src/__tests__/integration/ --verbose                                                                                                              │
│                                                                                                                                                            │
│ # 전체 테스트 실행                                                                                                                                         │
│ npm test                                                                                                                                                   │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
