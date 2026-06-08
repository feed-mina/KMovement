#!/usr/bin/env bash
# ── Celery/Redis Smoke Test ──────────────────────────────────────────────────
# Verifies: Redis healthcheck → worker boot → task roundtrip
#
# Usage:
#   ./scripts/celery_smoke_test.sh                    # uses docker-compose.local.yml
#   ./scripts/celery_smoke_test.sh docker-compose.gpu.yml  # uses specified compose file
#
# Prerequisites:
#   - Docker and docker compose installed
#   - .env file with required variables
#   - FASTAPI_INTERNAL_API_KEY in .env (or defaults to sdui-internal-dev-key)

set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.local.yml}"
API_KEY="${FASTAPI_INTERNAL_API_KEY:-sdui-internal-dev-key}"
BASE_URL="http://localhost:8000"
MAX_WAIT=120
POLL_INTERVAL=3

echo "=== Celery/Redis Smoke Test ==="
echo "Compose file: $COMPOSE_FILE"
echo ""

# ── Step 1: Start services ──────────────────────────────────────────────────
echo "[1/7] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d redis
sleep 2

echo "[2/7] Checking Redis health..."
for i in $(seq 1 20); do
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "  ✓ Redis is healthy"
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "  ✗ Redis failed to start"
        exit 1
    fi
    sleep 1
done

echo "[3/7] Starting FastAPI and Celery workers..."
docker compose -f "$COMPOSE_FILE" up -d
echo "  Waiting for FastAPI to be ready..."
STARTED=0
for i in $(seq 1 $MAX_WAIT); do
    if curl -sf "$BASE_URL/api/health" > /dev/null 2>&1; then
        STARTED=1
        break
    fi
    sleep 1
done
if [ "$STARTED" -eq 0 ]; then
    echo "  ✗ FastAPI failed to start within ${MAX_WAIT}s"
    docker compose -f "$COMPOSE_FILE" logs fastapi | tail -20
    exit 1
fi
echo "  ✓ FastAPI is healthy"

# ── Step 2: Verify workers registered ────────────────────────────────────────
echo "[4/7] Checking Celery worker connectivity..."
sleep 5  # Give workers time to connect

# ── Step 3: Submit a test task ───────────────────────────────────────────────
echo "[5/7] Submitting test weather prediction task..."
SUBMIT_RESPONSE=$(curl -sf -X POST "$BASE_URL/jobs/celery/weather" \
    -H "Content-Type: application/json" \
    -H "X-Internal-Api-Key: $API_KEY" \
    -d '{"sequence": [20.0, 21.5, 22.0, 23.1, 24.0]}' \
    2>&1) || {
    echo "  ✗ Task submission failed"
    echo "  Response: $SUBMIT_RESPONSE"
    exit 1
}

TASK_ID=$(echo "$SUBMIT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('task_id',''))" 2>/dev/null || echo "")
if [ -z "$TASK_ID" ]; then
    echo "  ✗ No task_id in response"
    echo "  Response: $SUBMIT_RESPONSE"
    exit 1
fi
echo "  ✓ Task submitted: $TASK_ID"

# ── Step 4: Poll for completion ──────────────────────────────────────────────
echo "[6/7] Polling task status..."
FINAL_STATUS=""
for i in $(seq 1 30); do
    STATUS_RESPONSE=$(curl -sf "$BASE_URL/jobs/celery/$TASK_ID" \
        -H "X-Internal-Api-Key: $API_KEY" 2>&1) || continue

    STATUS=$(echo "$STATUS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
    echo "  Poll $i: status=$STATUS"

    case "$STATUS" in
        SUCCESS)
            FINAL_STATUS="SUCCESS"
            break
            ;;
        FAILURE)
            FINAL_STATUS="FAILURE"
            ERROR=$(echo "$STATUS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "unknown")
            echo "  ✗ Task failed: $ERROR"
            break
            ;;
        *)
            sleep $POLL_INTERVAL
            ;;
    esac
done

# ── Step 5: Report results ───────────────────────────────────────────────────
echo ""
echo "[7/7] Results:"
echo "  Task ID:     $TASK_ID"
echo "  Final Status: ${FINAL_STATUS:-TIMEOUT}"

if [ "$FINAL_STATUS" = "SUCCESS" ]; then
    echo ""
    echo "=== ✓ SMOKE TEST PASSED ==="
    echo "  Redis:    healthy"
    echo "  Workers:  consuming tasks"
    echo "  Roundtrip: submit → poll → SUCCESS"
    exit 0
elif [ "$FINAL_STATUS" = "FAILURE" ]; then
    echo ""
    echo "=== ✗ SMOKE TEST FAILED ==="
    echo "  Task executed but returned FAILURE."
    echo "  This may be expected if TorchServe is not running."
    echo "  The important thing is: Redis → Worker → Task roundtrip works."
    echo ""
    echo "  To verify: check that the error is from TorchServe, not from"
    echo "  queue routing or Redis connectivity."
    exit 1
else
    echo ""
    echo "=== ✗ SMOKE TEST TIMEOUT ==="
    echo "  Task did not reach terminal status within polling window."
    echo "  Possible causes:"
    echo "    - Worker not consuming from 'ml' queue"
    echo "    - task_routes mismatch"
    echo "    - Redis connectivity issue"
    echo ""
    echo "  Check worker logs:"
    echo "    docker compose -f $COMPOSE_FILE logs celery-ml-worker"
    exit 1
fi
