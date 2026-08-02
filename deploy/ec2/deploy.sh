#!/usr/bin/env bash
# K-Ride EC2 배포 스크립트.
#
# 이 파일은 .github/workflows/deploy-ec2.yml 의 "Create deploy script" 단계가
# /tmp/deploy.sh 로 복사한 뒤, 밑줄 두 개로 감싼 자리표시자를 sed 로 치환해서
# 쓴다. 치환이 끝나면 "Deploy to EC2" 단계가 stdin 으로 원격 bash 에 넘긴다.
#
# 워크플로 YAML 안에 인라인으로 두지 않는 이유: GitHub Actions 는 단일 run
# 표현식을 21,000자로 제한한다. 인라인이던 시절 이 스크립트가 한도를 127자
# 넘겨 워크플로 자체가 startup failure 로 죽었다(2026-07-31, #209).
#
# 자리표시자를 새로 추가하면 워크플로의 sed 목록에도 반드시 같이 추가한다.
# 선언되지 않은 자리표시자는 치환되지 않은 채 원격에서 그대로 실행된다.
# tests/test_deploy_ec2_recovery.py 가 두 목록이 어긋나지 않는지 검증한다.
#
# 주의: deploy/ec2/ 는 배포 워크플로의 push 트리거에 포함돼 있다. 이 파일을
# 고쳐 main 에 올리면 운영 배포가 곧바로 돌고, 모든 서비스가 다시 올라간다.

set -e

docker network inspect sdui-network >/dev/null 2>&1 || docker network create sdui-network

remove_container() {
  CONTAINER_ID="$(docker ps -aq --filter "name=^/$1$" | head -n 1)"
  if [ -n "$CONTAINER_ID" ]; then
    docker rm -f "$CONTAINER_ID" || true
  fi
}

run_with_log_rotation() {
  docker run --log-opt max-size=10m --log-opt max-file=3 "$@"
}

drain_celery_worker() {
  WORKER_NAME="$1"
  QUEUE_NAME="$2"
  WORKER_STATUS="$(docker inspect --format '{{.State.Status}}' "$WORKER_NAME" 2>/dev/null || true)"
  if [ "$WORKER_STATUS" != "running" ]; then
    remove_container "$WORKER_NAME"
    return
  fi

  WORKER_NODE="celery@$(docker exec "$WORKER_NAME" hostname)"
  docker update --restart=no "$WORKER_NAME" >/dev/null
  docker exec "$WORKER_NAME" celery -A src.api.celery_app control \
    --destination="$WORKER_NODE" --timeout=5 cancel_consumer "$QUEUE_NAME" || true
  DRAINING_NAME="${WORKER_NAME}-draining-$(date +%s)"
  docker rename "$WORKER_NAME" "$DRAINING_NAME"
  docker exec "$DRAINING_NAME" celery -A src.api.celery_app control \
    --destination="$WORKER_NODE" --timeout=5 shutdown || true

  nohup sh -c "sleep 1900; docker rm -f '$DRAINING_NAME' >/dev/null 2>&1 || true" \
    >/dev/null 2>&1 &
}

assert_container_running() {
  CONTAINER_STATUS="$(docker inspect --format '{{.State.Status}}' "$1" 2>/dev/null || true)"
  if [ "$CONTAINER_STATUS" != "running" ]; then
    echo "$1 is not running (status: ${CONTAINER_STATUS:-missing})."
    docker logs --tail 100 "$1" 2>/dev/null || true
    exit 1
  fi
}

# nginx 의 location / 를 통해 프론트엔드 페이지가 실제로 렌더링되는지 확인한다.
# API 스모크만 있던 시절에는 Next.js 가 뜨지 않아도 배포가 초록불로 끝났다.
assert_frontend_page() {
  FRONTEND_PATH="$1"
  FRONTEND_BODY="$(mktemp)"
  FRONTEND_STATUS=""
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    FRONTEND_STATUS="$(curl -ksS --max-time 20 \
      --resolve yerin.duckdns.org:443:127.0.0.1 \
      --output "$FRONTEND_BODY" \
      --write-out '%{http_code}' \
      "https://yerin.duckdns.org${FRONTEND_PATH}" 2>/dev/null || true)"
    if [ "$FRONTEND_STATUS" = "200" ]; then
      break
    fi
    if [ "$attempt" = "12" ]; then
      echo "Frontend page ${FRONTEND_PATH} returned HTTP ${FRONTEND_STATUS:-unknown}."
      docker logs --tail 100 sdui-frontend 2>/dev/null || true
      rm -f "$FRONTEND_BODY"
      exit 1
    fi
    sleep 5
  done

  # 200 이어도 nginx 기본 페이지나 빈 응답일 수 있다. Next.js 가 서버 렌더링한
  # 문서인지 자산 참조로 확인한다.
  if ! grep -q '/_next/static' "$FRONTEND_BODY"; then
    echo "Frontend page ${FRONTEND_PATH} returned HTTP 200 without Next.js assets."
    head -c 500 "$FRONTEND_BODY"
    echo
    rm -f "$FRONTEND_BODY"
    exit 1
  fi
  rm -f "$FRONTEND_BODY"
  echo "Frontend page ${FRONTEND_PATH} is serving rendered Next.js output."
}

# 아래 소스들은 실패해도 애플리케이션이 조용히 빈 결과로 넘어간다. 호출부가
# 예외를 삼키고 배포는 그대로 성공하므로, 추천 품질만 떨어진 채 아무도 모르고
# 지나간다. 실제로 네 소스가 동시에 죽은 채 한동안 운영됐고 배포 로그에는 아무
# 흔적도 없었다(#217). 여기서 상태를 남겨 저하가 드러나게 한다.
#
# 배포를 실패시키지 않는다. 소스가 없어도 서비스는 동작하며, 여기서 막으면
# 무관한 변경의 배포까지 멈춘다. 경고로만 알린다.
report_optional_datasource_health() {
  if ! docker inspect kride-fastapi >/dev/null 2>&1; then
    echo "kride-fastapi is not present; skipping optional datasource diagnostics."
    return 0
  fi

  DATASOURCE_REPORT="$(docker exec kride-fastapi python -c '
import os, re

# 공개 저장소의 Actions 로그에 호스트가 남지 않도록 가린다.
_HOSTS = []
for _var, _label in (("SUPABASE_URL", "<supabase-host>"),):
    _m = re.search(r"//([^/:@]+)", os.environ.get(_var, ""))
    if _m:
        _HOSTS.append((_m.group(1), _label))

def redact(text):
    for _host, _label in _HOSTS:
        text = text.replace(_host, _label)
    return text

try:
    import chromadb
    client = chromadb.PersistentClient(path=os.environ.get("CHROMA_PATH", "/app/chroma_db"))
    names = sorted(getattr(c, "name", str(c)) for c in client.list_collections())
    docs = 0
    for name in names:
        try:
            docs += client.get_collection(name).count()
        except Exception:
            pass
    print("chroma=OK collections=" + str(len(names)) + " docs=" + str(docs) + " " + ",".join(names))
except Exception as exc:
    print("chroma=UNAVAILABLE " + type(exc).__name__ + ": " + str(exc)[:200])

# GraphRAG 는 이미지에 구운 models/kride_graph.json 을 읽는다. 파일이 빠져도
# 호출부가 예외를 삼켜 조용히 0건이 된다(#217). 사용자가 실제로 타는 공개
# 경로를 그대로 태워서 확인한다. 방탄소년단은 그래프에 있는 안정된 노드다.
try:
    from src.api.graphrag_client import search_artists_by_name, get_region_pois_from_graph
    probe_ids = search_artists_by_name(["방탄소년단"])
    probe_region = get_region_pois_from_graph(["서울"], max_pois=1)
    print(
        "graphrag=OK artist_probe=" + str(len(probe_ids))
        + " region_probe=" + str(len(probe_region))
    )
except Exception as exc:
    print("graphrag=UNAVAILABLE " + type(exc).__name__ + ": " + redact(str(exc))[:200])

# 앙상블 랭커도 같은 이유로 이미지에서 빠져 있었다. 없으면 단순 합산으로
# 떨어지므로 응답은 정상이고 순위 품질만 나빠진다.
try:
    from src.api.ensemble_client import _load_model
    print("ensemble=" + ("OK" if _load_model() else "NO_MODEL"))
except Exception as exc:
    print("ensemble=UNAVAILABLE " + type(exc).__name__ + ": " + str(exc)[:200])

# 키 종류를 함께 남긴다. 값은 절대 찍지 않는다. publishable/anon 키는 RLS 를
# 적용받는데, 정책이 SELECT 를 막으면 PostgREST 는 에러가 아니라 "0건"을 정상
# 응답으로 돌려준다. 그래서 "권한 없음"과 "정말 비어 있음"이 구분되지 않았고,
# 실제로 41,586건이 든 테이블을 여러 배포에 걸쳐 비었다고 보고했다. 그 보고를
# 믿고 데이터를 적재했다면 기존 행을 덮어쓸 뻔했다.
def supabase_key_kind():
    key = os.environ.get("SUPABASE_KEY", "")
    if not key:
        return "missing"
    if key.startswith("sb_secret_"):
        return "secret"
    if key.startswith("sb_publishable_"):
        return "publishable"
    if key.startswith("eyJ"):
        # 구형 JWT 키는 payload 의 role 로 구분한다. 서명 검증 없이 읽기만 하며
        # 키 자체는 출력하지 않는다.
        try:
            import base64, json as _json
            body = key.split(".")[1]
            body += "=" * (-len(body) % 4)
            role = _json.loads(base64.urlsafe_b64decode(body)).get("role", "")
            return "legacy-" + (role or "unknown")
        except Exception:
            return "legacy-unknown"
    return "unknown"

# Supabase 는 그래프 미러이자 GraphRAG/ChromaDB 실패 시의 마지막 대체 경로다.
# nodes 가 비면 /api/artists 도 하드코딩 목록으로 떨어진다.
try:
    from src.api.supabase_client import get_client
    sb = get_client()
    node_count = sb.table("nodes").select("id", count="exact").limit(1).execute().count
    edge_count = sb.table("edges").select("source_id", count="exact").limit(1).execute().count
    print(
        "supabase=OK nodes=" + str(node_count) + " edges=" + str(edge_count)
        + " key=" + supabase_key_kind()
    )
except Exception as exc:
    print(
        "supabase=UNAVAILABLE key=" + supabase_key_kind() + " "
        + type(exc).__name__ + ": " + redact(str(exc))[:200]
    )

# 경로 이력은 유일한 쓰기 경로다. RLS 가 INSERT 를 막으면 _insert_supabase 가
# 예외를 잡아 로그만 남기고 넘어가므로, 저장이 실패해도 응답은 정상이다.
# 읽기가 되는지라도 확인해 둔다. 진단에서 운영 테이블에 쓰지는 않는다.
try:
    from src.api.route_history import DEFAULT_TABLE_NAME
    from src.api.supabase_client import get_client as _gc
    table = os.environ.get("KRIDE_ROUTE_HISTORY_TABLE", DEFAULT_TABLE_NAME)
    rows = _gc().table(table).select("id", count="exact").limit(1).execute().count
    print("route_history=OK table=" + table + " rows=" + str(rows))
except Exception as exc:
    print("route_history=UNAVAILABLE " + type(exc).__name__ + ": " + redact(str(exc))[:200])
' 2>&1 || true)"

  echo "--- optional datasource health ---"
  echo "$DATASOURCE_REPORT"

  case "$DATASOURCE_REPORT" in
    *chroma=OK\ collections=0\ *)
      echo "::warning::ChromaDB has no collections; purpose-based POI search returns nothing. The index lives on the host at ~/kride-data/chroma_db and is mounted into kride-fastapi, so upload it there once instead of rebuilding the image. The container writes as root, so an existing directory may need sudo."
      ;;
    *chroma=OK*) ;;
    *)
      echo "::warning::ChromaDB is not readable inside kride-fastapi."
      ;;
  esac

  case "$DATASOURCE_REPORT" in
    *graphrag=OK\ artist_probe=0*)
      echo "::warning::GraphRAG loaded but the probe artist resolved to nothing; the graph file may be stale."
      ;;
    *graphrag=OK*) ;;
    *)
      echo "::warning::GraphRAG is unavailable; artist and region POI expansion returns nothing. Check that the image copies models/kride_graph.json."
      ;;
  esac

  # 원인마다 고쳐야 할 곳이 다르다. 파일이 멀쩡히 있는데도 "이미지가 파일을
  # 복사하는지 확인하라"고 안내해서 엉뚱한 곳을 보게 만든 적이 있다. 실제
  # 원인은 lightgbm 미설치였고, 그 상태로 배포가 계속 초록이었다.
  case "$DATASOURCE_REPORT" in
    *ensemble=OK*) ;;
    *ensemble=NO_MODEL*)
      echo "::warning::Ensemble ranker model file is missing; POI ranking falls back to a plain union. Check that the image copies models/ensemble_ranker.pkl."
      ;;
    *ensemble=UNAVAILABLE\ ModuleNotFoundError*)
      echo "::warning::Ensemble ranker cannot be unpickled because a dependency is missing; POI ranking falls back to a plain union. The model is a LightGBM LGBMRanker, so src/api/requirements-docker.txt must pin lightgbm. See the module name in the report line above."
      ;;
    *)
      echo "::warning::Ensemble ranker failed to load; POI ranking falls back to a plain union. See the report line above for the error."
      ;;
  esac

  # 0건 보고는 두 가지 뜻이 될 수 있고 고쳐야 할 곳이 서로 다르다. 브라우저용
  # 키로 0건이 나온 것은 대개 RLS 가 읽기를 막은 것이지 테이블이 빈 것이 아니다.
  # 실제로 그 상태에서 41,586건이 든 테이블을 비었다고 보고했다.
  case "$DATASOURCE_REPORT" in
    *supabase=OK\ nodes=0*key=publishable*|*supabase=OK\ nodes=0*key=legacy-anon*)
      echo "::warning::Supabase returned 0 rows with a browser-safe key. That usually means an RLS policy is blocking reads, not that the table is empty — verify with a secret key before concluding anything, and do not load data on the strength of this number. Every SUPABASE_KEY consumer here is server-side (kride-fastapi, kride-celery, scripts), so pointing the secret at a secret key is safe; a read-only RLS policy would fix reads but still leave route history writes blocked."
      ;;
    *supabase=OK\ nodes=0*)
      echo "::warning::Supabase nodes table is empty; /api/artists serves a hardcoded list and the itinerary fallback finds no POI."
      ;;
    *supabase=OK*) ;;
    *)
      echo "::warning::Supabase is not reachable from kride-fastapi."
      ;;
  esac

  case "$DATASOURCE_REPORT" in
    *route_history=OK*) ;;
    *)
      echo "::warning::The route history table is not readable from kride-fastapi; saving a route silently falls back to local JSONL and the history endpoints return nothing. Check the table exists and that the key may read it."
      ;;
  esac
}

pull_service_image() {
  echo "Pulling $1"
  df -h /var/lib/docker 2>/dev/null || df -h / || true
  docker system df || true
  docker pull "$1"
}

prune_unreferenced_service_images() {
  REFERENCED_IMAGE_IDS="$(
    docker ps -aq |
      xargs -r docker inspect --format '{{.Image}}' |
      sort -u
  )"

  for SERVICE_REPOSITORY in "$@"; do
    docker image ls "$SERVICE_REPOSITORY" --no-trunc \
      --format '{{.Repository}} {{.Tag}} {{.ID}}' |
      while read -r IMAGE_REPOSITORY IMAGE_TAG IMAGE_ID; do
        [ "$IMAGE_TAG" != "<none>" ] || continue
        IMAGE_REF="${IMAGE_REPOSITORY}:${IMAGE_TAG}"
        if printf '%s\n' "$REFERENCED_IMAGE_IDS" | grep -Fxq "$IMAGE_ID"; then
          echo "Preserving container-referenced image $IMAGE_REF ($IMAGE_ID)"
        else
          echo "Removing unreferenced service image $IMAGE_REF ($IMAGE_ID)"
          docker image rm "$IMAGE_REF" || true
        fi
      done
  done
}

assert_minimum_docker_space() {
  REQUIRED_KB="$1"
  AVAILABLE_KB="$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR == 2 { print $4 }')"
  if [ -z "$AVAILABLE_KB" ]; then
    AVAILABLE_KB="$(df -Pk / | awk 'NR == 2 { print $4 }')"
  fi
  if ! printf '%s' "$AVAILABLE_KB" | grep -Eq '^[0-9]+$'; then
    echo "Unable to determine free space for /var/lib/docker."
    exit 1
  fi
  if [ "$AVAILABLE_KB" -lt "$REQUIRED_KB" ]; then
    echo "Insufficient Docker disk space after safe cleanup: ${AVAILABLE_KB}KB available, ${REQUIRED_KB}KB required."
    docker system df -v || true
    exit 1
  fi
}

# ── Pre-evict: stop containers and remove images for services being
#    redeployed so that assert_minimum_docker_space can pass on a
#    nearly-full disk where every current image is referenced by a
#    running container and therefore cannot be pruned automatically. ──
if [ "__DEPLOY_FASTAPI__" = "true" ]; then
  remove_container kride-fastapi
  remove_container kride-celery-worker
  remove_container kride-celery-maintenance
  remove_container kride-celery-beat
  docker image rm __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__ __KRIDE_FASTAPI_IMAGE__:latest 2>/dev/null || true
  docker image rm __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__ __KRIDE_CELERY_IMAGE__:latest 2>/dev/null || true
fi
if [ "__DEPLOY_BACKEND__" = "true" ]; then
  remove_container __CONTAINER_NAME__
  docker image rm __SDUI_IMAGE__:__BRANCH_TAG__ __SDUI_IMAGE__:latest 2>/dev/null || true
fi
if [ "__DEPLOY_FRONTEND__" = "true" ]; then
  remove_container sdui-frontend
  docker image rm __FRONTEND_IMAGE__:__BRANCH_TAG__ __FRONTEND_IMAGE__:latest 2>/dev/null || true
fi

# ── Pull images ──
docker system df || true
prune_unreferenced_service_images \
  __SDUI_IMAGE__ \
  __FRONTEND_IMAGE__ \
  __KRIDE_FASTAPI_IMAGE__ \
  __KRIDE_CELERY_IMAGE__
docker image prune -f || true
docker builder prune -af || true
docker system df || true
assert_minimum_docker_space 4194304

# ── Redis ──
docker inspect sdui-redis >/dev/null 2>&1 || run_with_log_rotation -d --name sdui-redis \
  --network sdui-network \
  redis:7-alpine

# Deploy HMAC-capable consumers before enforcing the new FastAPI job
# token. Their extra header is backward-compatible with the old API.
# This order avoids leaving the old frontend/backend unable to poll if
# a later image pull or service replacement fails.

# ── Backend ──
if [ "__DEPLOY_BACKEND__" = "true" ]; then
  pull_service_image __SDUI_IMAGE__:__BRANCH_TAG__
  remove_container __CONTAINER_NAME__
  run_with_log_rotation -d --name __CONTAINER_NAME__ \
    -p __TARGET_PORT__:8080 \
    --network sdui-network \
    -e SPRING_PROFILES_ACTIVE=prod \
    -e SPRING_DATASOURCE_URL=jdbc:postgresql://sdui-db:5432/__DB_NAME__ \
    -e SPRING_DATASOURCE_USERNAME=__DB_USERNAME__ \
    -e SPRING_DATASOURCE_PASSWORD=__DB_PASSWORD__ \
    -e SPRING_DATA_REDIS_HOST=sdui-redis \
    -e SPRING_MAIL_PASSWORD=__MAIL_PASSWORD__ \
    -e JWT_SECRET_KEY=__JWT_SECRET_KEY__ \
    -e OPENAI_API_KEY=__OPENAI_API_KEY__ \
    -e TOUR_API_KEY=__TOUR_API_KEY__ \
    -e KAKAO_CLIENT_ID=__KAKAO_CLIENT_ID__ \
    -e KAKAO_REDIRECT_URI=__KAKAO_REDIRECT_URI__ \
    -e WEB_URL=__WEB_URL__ \
    -e AWS_ACCESS_KEY=__S3_ACCESS_KEY__ \
    -e AWS_SECRET_KEY=__S3_SECRET_KEY__ \
    -e FASTAPI_URL=__KRIDE_FASTAPI_URL__ \
    -e KRIDE_FASTAPI_URL=__KRIDE_FASTAPI_URL__ \
    -e FASTAPI_INTERNAL_API_KEY='__FASTAPI_INTERNAL_API_KEY__' \
    -e GCP_PROJECT_ID=__GCP_PROJECT_ID__ \
    -e GCP_PROCESSOR_ID=6ed87cfefab39a91 \
    -e GCP_CREDENTIALS_PATH=/app/gcp-credentials.json \
    -e SLACK_WEBHOOK_URL=__SLACK_WEBHOOK_URL__ \
    -e SLACK_BOT_TOKEN=__SLACK_BOT_TOKEN__ \
    -e SLACK_CHANNEL_ID=__SLACK_CHANNEL_ID__ \
    -e GOOGLE_CLIENT_ID=__GOOGLE_CLIENT_ID__ \
    -e GOOGLE_CLIENT_SECRET=__GOOGLE_CLIENT_SECRET__ \
    -e GOOGLE_REDIRECT_URI=__GOOGLE_REDIRECT_URI__ \
    -e SUPABASE_URL=__SUPABASE_URL__ \
    -e SUPABASE_KEY=__SUPABASE_KEY__ \
    -v /home/ubuntu/gcp-credentials.json:/app/gcp-credentials.json:ro \
    -v /home/ubuntu/firebase-adminsdk.json:/app/firebase-adminsdk.json:ro \
    -v /home/ubuntu/study-materials:/app/assets/study:ro \
    __SDUI_IMAGE__:__BRANCH_TAG__

  echo "Waiting for Spring Boot..."
  sleep 40
  assert_container_running __CONTAINER_NAME__
  docker logs --tail 80 __CONTAINER_NAME__
  docker exec sdui-redis redis-cli FLUSHDB || true
  docker image prune -f || true
fi

# ── Frontend ──
if [ "__DEPLOY_FRONTEND__" = "true" ]; then
  pull_service_image __FRONTEND_IMAGE__:__BRANCH_TAG__
  remove_container sdui-frontend
  run_with_log_rotation -d --name sdui-frontend \
    --network sdui-network \
    -p 3000:3000 \
    -e HOSTNAME=0.0.0.0 \
    -e BACKEND_URL=http://__CONTAINER_NAME__:8080 \
    -e FASTAPI_URL=__KRIDE_FASTAPI_URL__ \
    -e FASTAPI_INTERNAL_API_KEY='__FASTAPI_INTERNAL_API_KEY__' \
    __FRONTEND_IMAGE__:__BRANCH_TAG__

  echo "Waiting for Next.js..."
  sleep 10
  assert_container_running sdui-frontend
  docker logs --tail 20 sdui-frontend
  docker image prune -f || true
fi

# K-Ride FastAPI
if [ "__DEPLOY_FASTAPI__" = "true" ]; then
  pull_service_image __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__
  remove_container kride-fastapi

  # ChromaDB 인덱스는 이미지가 아니라 호스트에 둔다. gitignore 대상이라
  # 이미지에 굽던 시절에는 항상 빈 디렉터리가 실려 나갔다(#217). 여기에
  # 한 번 올려 두면 이후 배포는 같은 인덱스를 그대로 다시 마운트한다.
  # 컨테이너가 sqlite 에 써야 하므로 읽기 전용으로 걸지 않는다.
  CHROMA_HOST_DIR="$HOME/kride-data/chroma_db"
  mkdir -p "$CHROMA_HOST_DIR"

  run_with_log_rotation -d --name kride-fastapi \
    -p 8000:8000 \
    -v "$CHROMA_HOST_DIR":/app/chroma_db \
    --network sdui-network \
    --restart unless-stopped \
    -e PORT=8000 \
    -e TORCHSERVE_ENABLED=false \
    -e TORCHSERVE_FALLBACK=true \
    -e CELERY_BROKER_URL=redis://sdui-redis:6379/1 \
    -e CELERY_RESULT_BACKEND=redis://sdui-redis:6379/1 \
    -e CELERY_ML_TASKS_ENABLED=false \
    -e CHROMA_MODE=persistent \
    -e CHROMA_PATH=/app/chroma_db \
    -e KRIDE_MODELS_DIR=/app/dataset/models \
    -e KRIDE_RAW_DATA_DIR=/app/dataset/data/raw_ml \
    -e HF_HOME=/tmp/hf_cache \
    -e TRANSFORMERS_CACHE=/tmp/hf_cache/hub \
    -e SUPABASE_URL=__SUPABASE_URL__ \
    -e SUPABASE_KEY=__SUPABASE_KEY__ \
    -e GROQ_API_KEY=__GROQ_API_KEY__ \
    -e RUNPOD_API_KEY=__RUNPOD_API_KEY__ \
    -e RUNPOD_ENDPOINT_ID=__RUNPOD_ENDPOINT_ID__ \
    -e RUNPOD_MEDIA_ENDPOINT_ID=__RUNPOD_MEDIA_ENDPOINT_ID__ \
    -e RUNPOD_TORA_ENDPOINT_ID=__RUNPOD_TORA_ENDPOINT_ID__ \
    -e FASTAPI_INTERNAL_API_KEY='__FASTAPI_INTERNAL_API_KEY__' \
    __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__

  echo "Waiting for K-Ride FastAPI..."
  sleep 25
  docker logs --tail 80 kride-fastapi
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -fsS http://localhost:8000/api/health; then
      break
    fi
    if [ "$i" = "12" ]; then
      echo "K-Ride FastAPI health check failed."
      exit 1
    fi
    sleep 5
  done

  # The old API image is now unreferenced. Release it before pulling
  # the worker image; the worker reuses the API's heavy dependency layers.
  docker image prune -f || true
  pull_service_image __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__

  docker volume create kride-celery-temp >/dev/null
  docker volume create kride-celery-beat >/dev/null
  docker volume create kride-tora-ffmpeg-temp >/dev/null
  docker volume create kride-tora-meta-temp >/dev/null

  drain_celery_worker kride-celery-worker media
  run_with_log_rotation -d --name kride-celery-worker \
    --network sdui-network \
    --restart unless-stopped \
    -v kride-celery-temp:/tmp/kride-celery \
    -v kride-tora-ffmpeg-temp:/app/.tmp-tora-ffmpeg \
    -v kride-tora-meta-temp:/app/.tmp-tora-meta \
    -e CELERY_BROKER_URL=redis://sdui-redis:6379/1 \
    -e CELERY_RESULT_BACKEND=redis://sdui-redis:6379/1 \
    -e CELERY_MEDIA_TEMP_DIR=/tmp/kride-celery \
    -e CELERY_TEMP_TTL_HOURS=6 \
    -e CLOUDINARY_URL='__CLOUDINARY_URL__' \
    -e CLOUDINARY_CLOUD_NAME='__CLOUDINARY_CLOUD_NAME__' \
    -e CLOUDINARY_API_KEY='__CLOUDINARY_API_KEY__' \
    -e CLOUDINARY_API_SECRET='__CLOUDINARY_API_SECRET__' \
    -e KRIDE_RESULT_URL_REQUIRED=true \
    __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__ \
    celery -A src.api.celery_app worker -l info -c 1 -Q media

  # Cleanup is isolated from long-running media jobs so maintenance and
  # deployment checks cannot be starved behind a video queue backlog.
  remove_container kride-celery-maintenance
  run_with_log_rotation -d --name kride-celery-maintenance \
    --network sdui-network \
    --restart unless-stopped \
    -v kride-celery-temp:/tmp/kride-celery \
    -v kride-tora-ffmpeg-temp:/app/.tmp-tora-ffmpeg \
    -v kride-tora-meta-temp:/app/.tmp-tora-meta \
    -e CELERY_BROKER_URL=redis://sdui-redis:6379/1 \
    -e CELERY_RESULT_BACKEND=redis://sdui-redis:6379/1 \
    -e CELERY_MEDIA_TEMP_DIR=/tmp/kride-celery \
    -e CELERY_TEMP_TTL_HOURS=6 \
    __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__ \
    celery -A src.api.celery_app worker -l info -c 1 -Q maintenance

  remove_container kride-celery-beat
  run_with_log_rotation -d --name kride-celery-beat \
    --network sdui-network \
    --restart unless-stopped \
    -v kride-celery-beat:/tmp/celerybeat \
    -e CELERY_BROKER_URL=redis://sdui-redis:6379/1 \
    -e CELERY_RESULT_BACKEND=redis://sdui-redis:6379/1 \
    __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__ \
    celery -A src.api.celery_app beat -l info --schedule=/tmp/celerybeat/celerybeat-schedule

  sleep 8
  assert_container_running kride-celery-worker
  assert_container_running kride-celery-maintenance
  assert_container_running kride-celery-beat
  docker exec kride-celery-beat python -c \
    'from src.api.celery_app import celery; schedule = celery.conf.beat_schedule; assert schedule["cleanup-orphaned-media-temp-hourly"]["task"] == "src.api.tasks.task_cleanup_temp"; assert celery.conf.task_routes["src.api.tasks.task_cleanup_temp"]["queue"] == "maintenance"'
  docker exec kride-celery-worker python -c \
    'from deploy.media_motion.cloudinary_upload import _cloudinary_configured; raise SystemExit(0 if _cloudinary_configured() else "Cloudinary credentials are not usable")'
  docker exec kride-celery-worker python -c '
import tempfile, uuid
from pathlib import Path
from deploy.media_motion.cloudinary_upload import upload_to_cloudinary
artifact = Path(tempfile.gettempdir()) / f"kride-cloudinary-smoke-{uuid.uuid4()}.txt"
artifact.write_text("kride deployment smoke", encoding="utf-8")
try:
    result = upload_to_cloudinary(
        artifact,
        folder="kride/deploy-smoke",
        resource_type="raw",
        public_id=f"deploy-{uuid.uuid4()}",
    )
    if not result.get("ok") or not result.get("url"):
        raise SystemExit("Cloudinary delivery smoke failed: {}".format(result.get("error", "unknown")))
    try:
        import cloudinary.uploader
        cloudinary.uploader.destroy(result["public_id"], resource_type="raw", invalidate=True)
    except Exception as cleanup_error:
        print(f"Cloudinary smoke cleanup warning: {cleanup_error}")
finally:
    artifact.unlink(missing_ok=True)
'
  docker ps --filter name=kride-celery --format "table {{.Names}}\t{{.Status}}"
  docker logs --tail 40 kride-celery-worker
  docker logs --tail 40 kride-celery-maintenance
  docker logs --tail 40 kride-celery-beat
  docker image prune -f || true
fi

# ── Host Nginx (SSL) ──
# Docker Nginx 제거 (포트 충돌 방지)
docker stop sdui-nginx 2>/dev/null || true
docker rm sdui-nginx 2>/dev/null || true

# Host Nginx config 적용 + 재시작
sudo ln -sf /etc/nginx/sites-available/yerin.duckdns.org /etc/nginx/sites-enabled/yerin.duckdns.org
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
curl -fsS http://localhost:8000/api/health >/dev/null
curl -kfsS --resolve yerin.duckdns.org:443:127.0.0.1 https://yerin.duckdns.org/kride-api/health >/dev/null

assert_container_running sdui-frontend
assert_frontend_page /
assert_frontend_page /travel/kpop
assert_frontend_page /travel/food

assert_container_running kride-celery-worker
assert_container_running kride-celery-maintenance
assert_container_running kride-celery-beat

# Worker responsiveness and SSE/result-backend streaming are checked
# separately so a legitimate media backlog cannot fail deployment.
CELERY_INSPECT="$(docker exec kride-celery-worker \
  celery -A src.api.celery_app inspect active_queues --timeout=10)"
printf '%s' "$CELERY_INSPECT" | grep -q "'name': 'media'" || {
  echo "Celery media worker did not report the media queue."
  exit 1
}
printf '%s' "$CELERY_INSPECT" | grep -q "'name': 'maintenance'" || {
  echo "Celery maintenance worker did not report the maintenance queue."
  exit 1
}

SSE_SMOKE_TASK_ID="$(cat /proc/sys/kernel/random/uuid)"
printf '%s' "$SSE_SMOKE_TASK_ID" \
  | grep -Eq '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' || {
  echo "Celery SSE smoke test did not create a UUID task id."
  exit 1
}
docker exec -e SSE_SMOKE_TASK_ID="$SSE_SMOKE_TASK_ID" \
  kride-celery-maintenance python -c \
  'import os; from src.api.celery_app import celery; celery.backend.store_result(os.environ["SSE_SMOKE_TASK_ID"], {"smoke": True}, "SUCCESS")'

SSE_SMOKE_HEADERS="$(mktemp)"
SSE_SMOKE_BODY="$(mktemp)"
SSE_CURL_STATUS=0
curl -kNsS --max-time 45 \
  --resolve yerin.duckdns.org:443:127.0.0.1 \
  --header 'X-Internal-Api-Key: __FASTAPI_INTERNAL_API_KEY__' \
  --dump-header "$SSE_SMOKE_HEADERS" \
  --output "$SSE_SMOKE_BODY" \
  "https://yerin.duckdns.org/jobs/celery/${SSE_SMOKE_TASK_ID}/stream" \
  2>/dev/null || SSE_CURL_STATUS=$?

SSE_HTTP_STATUS="$(awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "$SSE_SMOKE_HEADERS")"
if [ "$SSE_CURL_STATUS" -ne 0 ]; then
  rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
  echo "Celery SSE smoke test request failed (curl status $SSE_CURL_STATUS)."
  exit 1
fi
if [ "$SSE_HTTP_STATUS" != "200" ]; then
  rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
  echo "Celery SSE smoke test returned HTTP ${SSE_HTTP_STATUS:-unknown}."
  exit 1
fi
if ! grep -qi '^content-type:[[:space:]]*text/event-stream' "$SSE_SMOKE_HEADERS"; then
  rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
  echo "Celery SSE smoke test did not return text/event-stream."
  exit 1
fi
if ! grep -Eq '^data: .*"status"[[:space:]]*:[[:space:]]*"SUCCESS"' "$SSE_SMOKE_BODY"; then
  rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
  echo "Celery result backend did not reach SUCCESS through SSE."
  exit 1
fi
if ! grep -q '^data: \[DONE\]$' "$SSE_SMOKE_BODY"; then
  rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
  echo "Celery SSE stream did not terminate with [DONE]."
  exit 1
fi
rm -f "$SSE_SMOKE_HEADERS" "$SSE_SMOKE_BODY"
echo "Celery media/maintenance workers, beat, result backend, and authenticated SSE route are healthy."

report_optional_datasource_health

echo "=== Deployment complete ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
