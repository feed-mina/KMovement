
  ⎿  Response:
       Perfect! Now I have comprehensive information. Let me create a detailed summary document.

       KRIDE Project - Complete Architecture Exploration Report

       Based on my thorough exploration of the kride-project directory structure, I've compiled a comprehensive analysis of all three major
       services, databases, deployment configurations, and architecture documentation. Here are my findings:

       ---
       1. SPRING BOOT BACKEND (SDUI Server)

       Location

       /d/kride-project/subproject/SDUI/SDUI-server/

       Build Configuration

       - Build Tool: Gradle
       - File: /d/kride-project/subproject/SDUI/SDUI-server/build.gradle
       - Java Version: 17 (Temurin JDK)
       - Spring Boot: 3.1.4

       Key Dependencies

       - Core: Spring Web, Data JPA, Security, WebSocket, Mail
       - Database: PostgreSQL driver, MyBatis, Flyway (DB migrations)
       - Cache: Redis (Spring Data Redis)
       - API Docs: SpringDoc OpenAPI (Swagger)
       - Cloud: AWS S3 SDK v2, Google Cloud Document AI
       - Auth: JWT (jjwt), OAuth2 (Kakao, Google)
       - AI: OpenAI API, Groq (commented)

       Configuration Files

       ┌───────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────┐
       │                                         File                                          │           Purpose            │
       ├───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
       │ /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/application.yml       │ Default config (localhost)   │
       ├───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
       │ /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/application-prod.yml  │ Production config (env vars) │
       ├───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────┤
       │ /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/application-local.yml │ Local development overrides  │
       └───────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────┘

       Key Configuration Details (application.yml)

       Database:
       - Driver: PostgreSQL (localhost:5432)
       - DB: testdb (default), overridden to SDUI_TD in local profile
       - User: postgres / password: 1234
       - Connection Pool: HikariCP (max 12, idle 600s)

       Cache:
       - Redis: localhost:6379
       - JPA: Hibernate (validate DDL mode)

       Flyway Migrations:
       - Enabled with baseline version 0
       - Location: classpath:db/migration
       - Current: V1 → V47+ (verified via git status)

       Auth:
       - JWT Secret: d6ac9ecc0a3aa3c395313fb236e0ec10d71ab78fb36f54ba626664eba0b842b1
       - Expiration: 86400000 ms (24 hours)
       - Kakao OAuth: Redirect to localhost:8080/api/kakao/callback

       External Services:
       - OpenAI: gpt-4o-mini (dummy-local dev key)
       - FastAPI: http://localhost:8001
       - AWS S3: Bucket sdui-273354627025-ap-northeast-2-an (region: ap-northeast-2)
       - GCP Document AI: Project "kdeliver", Processor ID 6ed87cfefab39a91
       - Supabase: (config provided but endpoint not listed)
       - KRIDE FastAPI: http://localhost:8000 (comments indicate this is separate)

       Web URLs:
       - Web: http://localhost:3000 (dev) → https://sdui-delta.vercel.app (prod)
       - Mobile: http://sdui-delta.vercel.app:// (dev)

       Docker Deployment

       - File: /d/kride-project/subproject/SDUI/SDUI-server/Dockerfile
       - Base Image: eclipse-temurin:17-jdk-jammy (2-stage build)
       - Exposed Port: 8080

       Domain Packages (Spring Boot Services)

       Location: /d/kride-project/subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/domain/

       ┌─────────────┬─────────────────────────────────────────────────────────────┐
       │   Domain    │                           Purpose                           │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ admin/      │ Admin dashboard & statistics                                │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ ai/         │ AI features                                                 │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ community/  │ Community posts, likes, reports, follows (Supabase storage) │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ content/    │ Content management                                          │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ google/     │ Google OAuth integration                                    │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ interview/  │ AI interview coaching                                       │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ kakao/      │ Kakao OAuth integration                                     │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ kridechat/  │ KRIDE chatbot (FastAPI proxy via SSE)                       │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ leetcode/   │ Study/learning features                                     │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ Location/   │ Location-based services                                     │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ membership/ │ User membership                                             │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ query/      │ Dynamic SQL query execution (query_master table)            │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ study/      │ Study management                                            │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ ui/         │ SDUI metadata rendering engine                              │
       ├─────────────┼─────────────────────────────────────────────────────────────┤
       │ user/       │ Auth, login, register, email verification                   │
       └─────────────┴─────────────────────────────────────────────────────────────┘

       Database Migrations

       Location: /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/db/migration/

       Migration Range: V1 (baseline) → V47+ (ongoing)
       - V1: baseline_schema.sql
       - V10-V39: Various feature additions (bento cards, admin dashboard, query system, user features, etc.)
       - V40-V47: K-Ride SDUI screen implementations (screens, layouts, components)
       - Notable: V48-V49 are manually applied via pgAdmin (documented in .ai/architect/research.md)

       ---
       2. NEXT.JS FRONTEND (Metadata Project)

       Location

       /d/kride-project/subproject/SDUI/metadata-project/

       Build Configuration

       - Package.json: /d/kride-project/subproject/SDUI/metadata-project/package.json
       - Next.js: 16.1.3
       - React: 19.2.3
       - Node: Runtime environment with TypeScript 5.7.3

       Key Dependencies

       - State Management: @tanstack/react-query (5.66.0)
       - Maps: leaflet, react-leaflet (map rendering for K-Ride itineraries)
       - UI: Framer Motion (animations), Tailwind CSS v4
       - Forms: react-datepicker, react-daum-postcode (address selection)
       - PWA: next-pwa (5.6.0) with webpack (turbopack disabled due to conflicts)
       - API: axios, STOMP for WebSocket
       - Analytics: @vercel/analytics

       Next.js Configuration

       File: /d/kride-project/subproject/SDUI/metadata-project/next.config.ts

       Rewrites:
       /kride-api/* → http://localhost:8000/api/*   (K-Ride FastAPI)
       /api/*       → ${BACKEND_URL}/api/*          (Spring Boot SDUI)

       Deployment URLs:
       - Dev: BACKEND_URL = http://localhost:8080
       - Prod: BACKEND_URL = https://yerin.duckdns.org (EC2 DNS)

       Security Headers:
       - CSP: Allows Kakao APIs, Vercel Live, Daum postcode iframe
       - X-Frame-Options: DENY
       - X-Content-Type-Options: nosniff

       PWA:
       - Disabled in development
       - Enabled in production with service worker registration

       NPM Scripts

       ┌─────────────────────┬────────────────────────────────┐
       │       Command       │            Purpose             │
       ├─────────────────────┼────────────────────────────────┤
       │ npm run dev         │ Dev server with --webpack flag │
       ├─────────────────────┼────────────────────────────────┤
       │ npm run build       │ Production build               │
       ├─────────────────────┼────────────────────────────────┤
       │ npm run test        │ Jest + NYC coverage            │
       ├─────────────────────┼────────────────────────────────┤
       │ npm run lint        │ ESLint                         │
       ├─────────────────────┼────────────────────────────────┤
       │ npx playwright test │ E2E tests                      │
       └─────────────────────┴────────────────────────────────┘

       Key Frontend Features

       - SDUI DynamicEngine: /components/DynamicEngine/ - Renders metadata tree
       - Component Map: /components/constants/componentMap.tsx - Maps component_type to React components
       - Metadata Provider: Fetches UI metadata from Spring Boot
       - K-Ride Components: SelectionCard, PurposeCard, KrideNextButton, KrideWarningToast
       - Onboarding Flow: INTRO1 (duration) → INTRO2 (artists) → INTRO3 (regions) → INTRO4 (purposes) → INTRO5 (budget) → MY_LIST → FOCUS
       - Local Storage: kride_form persists onboarding state

       Testing Infrastructure

       - Jest Tests: /tests/ directory
       - Test Reports: /tests/logs/frontend-report.html
       - MSW: Mock Service Worker for API mocking
       - Test Libraries: @testing-library/react, @testing-library/jest-dom

       ---
       3. FASTAPI BACKEND (K-Ride API)

       Location (KRIDE FastAPI)

       Main: /d/kride-project/src/api/fastapi_server.py
       SDUI Pronounce API: /d/kride-project/subproject/SDUI/pronounce-api/

       FastAPI Server (K-Ride)

       File: /d/kride-project/src/api/fastapi_server.py
       - Port: 8000 (default)
       - Title: "K-Ride API"
       - Version: 1.0.0
       - CORS: Allow all origins (configured for Vercel URL in production)

       Key Modules

       ┌────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
       │       Module       │                                    Purpose                                    │
       ├────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
       │ neo4j_client.py    │ Neo4j AuraDB queries for artist POIs, region POIs, regions                    │
       ├────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
       │ rag_client.py      │ RAG pipeline: purpose search, recommendation generation, itinerary generation │
       ├────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
       │ supabase_client.py │ Supabase integration for artist data, POI details                             │
       ├────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
       │ ensemble_client.py │ Ensemble ranker model (poi ranking)                                           │
       └────────────────────┴───────────────────────────────────────────────────────────────────────────────┘

       Data Loading

       - Route Graph: models/route_graph.pkl (G and G_main networkx graphs)
       - Scored Roads: data/raw_ml/road_scored.csv
       - Facilities: data/raw_ml/facility_clean.csv
       - POIs: data/raw_ml/tour_poi.csv

       Key Endpoints

       ┌──────────────────────────┬────────┬──────────────────────────────────────────┐
       │         Endpoint         │ Method │                 Purpose                  │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/recommend           │ POST   │ Recommend POIs within radius             │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/route               │ POST   │ A→B optimal path (Dijkstra)              │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/course              │ POST   │ Circular route from start point          │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/facilities          │ GET    │ Nearby facilities within radius          │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/pois                │ GET    │ Nearby POIs within radius                │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/health              │ GET    │ Server status                            │
       ├──────────────────────────┼────────┼──────────────────────────────────────────┤
       │ /api/recommend/itinerary │ POST   │ Generate full itinerary with map markers │
       └──────────────────────────┴────────┴──────────────────────────────────────────┘

       FastAPI Utilities

       - Haversine Distance: For lat/lon coordinate calculations
       - Geocoding: Nominatim OSM API (async) for address → coordinate conversion
       - Facility Detection: Within 500m radius of path
       - POI Detection: Within 1000m radius of path

       SDUI Pronounce-API (FastAPI)

       Location: /d/kride-project/subproject/SDUI/pronounce-api/
       Port: 8001
       Dockerfile: Uses Python 3.11-slim with Java JDK for konlpy (Korean NLP)

       Dependencies:
       - FastAPI, Uvicorn (server)
       - Google Cloud Text-to-Speech (TTS)
       - konlpy (Korean NLP)
       - PyYAML, python-dotenv (config)

       ---
       4. DATABASES

       Local Development Databases

       ┌─────────────────────┬─────────┬──────────┬──────────┬───────────────┬──────────────────────────────────────────┐
       │      Database       │ Version │   Port   │ DB Name  │    User/PW    │                   Role                   │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ PostgreSQL (SDUI)   │ 18      │ 5432     │ SDUI_TD  │ postgres/1234 │ Spring Boot metadata, UI, users, content │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ PostgreSQL (K-Ride) │ 16      │ (custom) │ kride DB │ (unchecked)   │ FastAPI POI, artist_poi (960k+ records)  │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ Neo4j AuraDB        │ Cloud   │ —        │ —        │ —             │ Artist-location knowledge graph          │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ Supabase            │ Cloud   │ —        │ —        │ —             │ Community image storage, user data       │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ ChromaDB            │ Local   │ —        │ —        │ —             │ Purpose vector embedding search          │
       ├─────────────────────┼─────────┼──────────┼──────────┼───────────────┼──────────────────────────────────────────┤
       │ Redis               │ Latest  │ 6379     │ —        │ —             │ Spring Boot cache (SDUI metadata)        │
       └─────────────────────┴─────────┴──────────┴──────────┴───────────────┴──────────────────────────────────────────┘

       Production Databases (EC2)

       Docker-Compose Based:
       - PostgreSQL: 15 (Docker)
       - Redis: Latest (Docker)
       - Actual production DB details incomplete (needs EC2 verification)

       Database Schema

       SDUI Core Tables:
       - ui_metadata — Component, layout, action definitions
       - query_master — Dynamic SQL queries for data fetching
       - users — User accounts, roles
       - user_role — RBAC assignments (GUEST, USER, ADMIN, etc.)
       - flyway_schema_history — Migration tracking
       - Community, study, interview, location tables (various domains)

       ---
       5. DEPLOYMENT & CI/CD

       GitHub Actions Pipeline

       File: /d/kride-project/subproject/SDUI/.github/workflows/deploy.yml

       Triggers: Pushes to main or lab/claude-dev branches

       Build Steps:
       1. Checkout code
       2. Set up JDK 17 (Temurin)
       3. Validate directory structure
       4. Grant execute permissions on gradlew
       5. Build Spring Boot JAR (skip tests): ./gradlew clean build -x test
       6. Validate Flyway migrations
       7. Set environment variables (branch → port/container/db mapping)
       8. Login to Docker Hub
       9. Build & push Docker images (Spring Boot + FastAPI if enabled)
       10. Deploy to AWS EC2 via SSH

       Docker Image Naming:
       - Spring Boot: ${DOCKER_USERNAME}/sdui-app:${BRANCH_TAG}
       - FastAPI: ${DOCKER_USERNAME}/sdui-fastapi:latest

       Branch-Based Deployment:

       ┌────────────────┬─────────────┬──────────────────┬──────────┬───────────┐
       │     Branch     │ Target Port │    Container     │    DB    │    SSL    │
       ├────────────────┼─────────────┼──────────────────┼──────────┼───────────┤
       │ main           │ 8080        │ sdui-backend     │ SDUI_TD  │ HTTP (no) │
       ├────────────────┼─────────────┼──────────────────┼──────────┼───────────┤
       │ lab/claude-dev │ 8081        │ sdui-backend-lab │ SDUI_LAB │ HTTP (no) │
       └────────────────┴─────────────┴──────────────────┴──────────┴───────────┘

       Production Runtime (Docker):
       - Network: sdui-network (bridge)
       - Port Mapping: TARGET_PORT:8080
       - Environment Injection: Spring profiles active, DB credentials, API keys, cloud creds (GCP, AWS)
       - GCP Credentials: Mounted from /home/ubuntu/gcp-credentials.json
       - Health Check: Wait 30s, then log tail
       - Flyway Check: Query migration history
       - Redis Cache Flush: FLUSHDB after deployment

       Docker Compose (Local Development)

       File: /d/kride-project/subproject/SDUI/docker-compose.yml

       Services:
       1. PostgreSQL 15 (SDUI_TD) — port 5434
       2. Redis Latest — port 6379
       3. Spring Boot (SDUI-server) — port 8080
       4. FastAPI (pronounce-api) — DISABLED (if: false)

       Local Dev Startup:
       docker-compose up -d

       Root Project Docker Compose

       File: /d/kride-project/docker-compose.yml

       Services:
       1. PostgreSQL 14 with PostGIS (kride_safety DB)
       2. PGAdmin (web UI for DB)
       3. ML Server (FastAPI for K-Ride models)

       ---
       6. ARCHITECTURE DOCUMENTATION

       .ai Documentation Structure

       Master Index: /d/kride-project/.ai/INDEX.md

       Architect Documents

       - File: /d/kride-project/.ai/architect/agent.md — Role definition
       - File: /d/kride-project/.ai/architect/research.md — MSA architecture analysis (3 services, 5+ databases)
       - File: /d/kride-project/.ai/architect/plan.md — Improvement roadmap (FOCUS FastAPI integration, V44/V45 migrations)
       - File: /d/kride-project/.ai/architect/phase_completion.md — Phase tracking
       - File: /d/kride-project/.ai/architect/supabase_neo4l_sql_example.txt — Data examples

       Key Architecture Documents

       - File: /d/kride-project/.ai/architecture_expand_0520.md — Full MSA breakdown with database roles, data flow, FastAPI pipelines, and design
       decisions
       - File: /d/kride-project/.ai/kride_sdui_screen.md — SDUI screen implementation (Phase 1~4)
       - File: /d/kride-project/.ai/kride.md — Firebase & environment setup (1,283 lines)
       - File: /d/kride-project/.ai/new_research.md — K-Ride 2.0 research history (1,499 lines)

       Backend Engineer Documents

       - File: /d/kride-project/.ai/backend_engineer/research.md — FastAPI endpoints, Neo4j/ChromaDB/Groq pipelines
       - File: /d/kride-project/.ai/backend_engineer/plan.md — FOCUS-FastAPI integration implementation

       Frontend Engineer Documents

       - File: /d/kride-project/.ai/frontend_engineer/agent.md — DynamicEngine expert role
       - File: /d/kride-project/.ai/frontend_engineer/research.md — Onboarding flow analysis

       AI Engineer Documents

       - File: /d/kride-project/.ai/ai_engineer/agent.md — ML engineer role definition
       - File: /d/kride-project/.ai/ai_engineer/research.md — Model status, data ranges, RAG pipelines

       SDUI Subproject Documentation

       File: /d/kride-project/subproject/SDUI/CLAUDE.md — Comprehensive SDUI workflow, architecture, API design

       File: /d/kride-project/subproject/SDUI/README.md — SDUI project overview with architecture diagrams

       ---
       7. KEY ARCHITECTURAL INSIGHTS

       SDUI (Server-Driven UI) Pattern

       - Core Principle: UI metadata in ui_metadata table → DynamicEngine renders at runtime
       - Zero Redeploy: DB row changes → immediate UI updates
       - Component Type Mapping: component_type string → React component lookup
       - Repeaters: Groups with ref_data_id map over arrays
       - CSS Handling: grid and flex-wrap keywords prevent DynamicEngine from forcing direction classes

       K-Ride MSA (3 Services)

       1. Spring Boot (SDUI): Metadata, auth, community, user management
       2. FastAPI (K-Ride): Recommendation engine, Neo4j queries, RAG pipelines
       3. Frontend (Next.js): PWA, DynamicEngine, onboarding flow

       Data Flow: Onboarding → Recommendation

       User Input (INTRO1-5)
         → localStorage['kride_form']
         → GOTO_FOCUS action
         → POST /api/recommend/itinerary (to FastAPI port 8000)
         → Neo4j (artist POIs) + ChromaDB (purpose vectors) + Groq LLM
         → Itinerary + Map markers
         → FOCUS screen renders

       Database Role Separation (Critical)

       - SDUI (Spring Boot): PostgreSQL 5432/SDUI_TD (UI, users, queries)
       - K-Ride (FastAPI): PostgreSQL 16 (POI, artist data 960k+)
       - Knowledge Graph: Neo4j AuraDB (artist-location relationships)
       - Vector Search: ChromaDB local (purpose embeddings)
       - Cloud Storage: Supabase (community images)
       - Cache: Redis (SDUI metadata)

       Deployment Strategy

       - Dev: Localhost all services
       - Lab: EC2 with lab/claude-dev branch → port 8081
       - Prod: EC2 with main branch → port 8080
       - CI/CD: GitHub Actions → Docker build → Push to Hub → SSH deploy → Health check → Migration validate

       Missing/Incomplete Configurations

       1. Neo4j Connection: Credentials in .env (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)
       2. Supabase: Credentials available but integration points unclear
       3. GCP Document AI: Configured but usage context needs verification
       4. FastAPI Deployment: Only locally configured (port 8000), not in EC2 docker-compose
       5. Kubernetes: No k8s manifests found (Docker Compose only)
       6. TLS/SSL: Both local and production use HTTP (no SSL termination config visible)

       ---
       File Paths Summary

       Critical Configuration Files

       - Spring Boot: /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/application.yml
       - NextJS: /d/kride-project/subproject/SDUI/metadata-project/next.config.ts
       - FastAPI: /d/kride-project/src/api/fastapi_server.py
       - Build (Backend): /d/kride-project/subproject/SDUI/SDUI-server/build.gradle
       - Build (Frontend): /d/kride-project/subproject/SDUI/metadata-project/package.json
       - Deployment: /d/kride-project/subproject/SDUI/.github/workflows/deploy.yml
       - Docker (SDUI): /d/kride-project/subproject/SDUI/docker-compose.yml
       - Docker (Project): /d/kride-project/docker-compose.yml

       Database Migrations

       - Location: /d/kride-project/subproject/SDUI/SDUI-server/src/main/resources/db/migration/
       - Range: V1 (baseline) → V47+ (K-Ride screens)

       Architecture Documentation

       - Master Index: /d/kride-project/.ai/INDEX.md
       - MSA Analysis: /d/kride-project/.ai/architect/research.md
       - Detailed Architecture: /d/kride-project/.ai/architecture_expand_0520.md
       - SDUI Guide: /d/kride-project/subproject/SDUI/CLAUDE.md
       - SDUI Readme: /d/kride-project/subproject/SDUI/README.md