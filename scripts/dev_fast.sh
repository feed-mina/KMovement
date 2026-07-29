#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$ROOT_DIR/.cache/dev-fast"
mkdir -p "$CACHE_DIR"

# Speed-first defaults. Override when needed:
#   KM_REQUIREMENTS_MODE=full ./scripts/dev_fast.sh deps
#   KM_INSTALL_METADATA=1 ./scripts/dev_fast.sh deps
KM_REQUIREMENTS_MODE="${KM_REQUIREMENTS_MODE:-docker}"  # docker | full
KM_INSTALL_METADATA="${KM_INSTALL_METADATA:-0}"          # 0 | 1

info() { printf "[dev-fast] %s\n" "$*"; }
warn() { printf "[dev-fast][warn] %s\n" "$*"; }
err()  { printf "[dev-fast][error] %s\n" "$*" >&2; }

have_cmd() { command -v "$1" >/dev/null 2>&1; }

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif have_cmd docker-compose; then
    echo "docker-compose"
  else
    err "docker compose/docker-compose가 필요합니다."
    exit 1
  fi
}

calc_group_hash() {
  local files=("$@")
  local digest_input=""
  local f

  for f in "${files[@]}"; do
    if [[ -f "$ROOT_DIR/$f" ]]; then
      digest_input+="$(sha256sum "$ROOT_DIR/$f")\n"
    else
      digest_input+="MISSING $f\n"
    fi
  done

  printf "%b" "$digest_input" | sha256sum | awk '{print $1}'
}

needs_sync() {
  local marker="$1"
  local current_hash="$2"

  if [[ ! -f "$marker" ]]; then
    return 0
  fi

  local saved_hash
  saved_hash="$(cat "$marker")"
  [[ "$saved_hash" != "$current_hash" ]]
}

write_marker() {
  local marker="$1"
  local current_hash="$2"
  printf "%s" "$current_hash" > "$marker"
}

ensure_python_env() {
  if [[ ! -d "$ROOT_DIR/.venv" ]]; then
    info ".venv 생성"
    python3 -m venv "$ROOT_DIR/.venv"
  fi

  # shellcheck disable=SC1091
  source "$ROOT_DIR/.venv/bin/activate"
  python -m pip install --upgrade pip >/dev/null
}

sync_python_deps() {
  local marker="$CACHE_DIR/python_${KM_REQUIREMENTS_MODE}.sha256"
  local req_files=()

  if [[ "$KM_REQUIREMENTS_MODE" == "full" ]]; then
    req_files=("src/api/requirements.txt")
  else
    req_files=("src/api/requirements-docker.txt")
  fi

  local current_hash
  current_hash="$(calc_group_hash "${req_files[@]}")"

  if needs_sync "$marker" "$current_hash"; then
    info "Python 의존성 설치 시작 (mode=$KM_REQUIREMENTS_MODE)"
    ensure_python_env

    local req
    for req in "${req_files[@]}"; do
      python -m pip install -r "$ROOT_DIR/$req"
    done

    write_marker "$marker" "$current_hash"
    info "Python 의존성 설치 완료"
  else
    info "Python 의존성 변경 없음, 설치 건너뜀"
  fi
}

sync_kride_web_deps() {
  local marker="$CACHE_DIR/kride_web.sha256"
  local files=(
    "subproject/SDUI/kride/pnpm-lock.yaml"
    "subproject/SDUI/kride/package.json"
    "subproject/SDUI/kride/apps/mobile/package.json"
    "subproject/SDUI/kride/packages/core/package.json"
  )

  local current_hash
  current_hash="$(calc_group_hash "${files[@]}")"

  if needs_sync "$marker" "$current_hash"; then
    info "kride(Node) 의존성 설치 시작"
    pushd "$ROOT_DIR/subproject/SDUI/kride" >/dev/null

    if have_cmd pnpm; then
      pnpm install --prefer-offline --frozen-lockfile
    elif have_cmd npm; then
      npm ci
    else
      err "pnpm 또는 npm이 필요합니다."
      popd >/dev/null
      exit 1
    fi

    popd >/dev/null
    write_marker "$marker" "$current_hash"
    info "kride(Node) 의존성 설치 완료"
  else
    info "kride(Node) 의존성 변경 없음, 설치 건너뜀"
  fi
}

sync_metadata_deps_if_enabled() {
  if [[ "$KM_INSTALL_METADATA" != "1" ]]; then
    info "metadata-project 설치 생략 (KM_INSTALL_METADATA=1 로 활성화)"
    return
  fi

  local marker="$CACHE_DIR/metadata.sha256"
  local files=(
    "subproject/SDUI/metadata-project/package-lock.json"
    "subproject/SDUI/metadata-project/package.json"
  )

  local current_hash
  current_hash="$(calc_group_hash "${files[@]}")"

  if needs_sync "$marker" "$current_hash"; then
    info "metadata-project(Node) 의존성 설치 시작"
    pushd "$ROOT_DIR/subproject/SDUI/metadata-project" >/dev/null

    if have_cmd npm; then
      npm ci
    else
      err "npm이 필요합니다."
      popd >/dev/null
      exit 1
    fi

    popd >/dev/null
    write_marker "$marker" "$current_hash"
    info "metadata-project(Node) 의존성 설치 완료"
  else
    info "metadata-project(Node) 의존성 변경 없음, 설치 건너뜀"
  fi
}

deps() {
  sync_python_deps
  sync_kride_web_deps
  sync_metadata_deps_if_enabled
}

up() {
  deps
  local ccmd
  ccmd="$(compose_cmd)"
  info "Docker 서비스 시작"
  # shellcheck disable=SC2086
  $ccmd up -d
  info "완료: API/docs 확인 -> http://localhost:8000/docs"
}

down() {
  local ccmd
  ccmd="$(compose_cmd)"
  info "Docker 서비스 중지"
  # shellcheck disable=SC2086
  $ccmd down
}

status() {
  info "캐시 상태"
  ls -1 "$CACHE_DIR" 2>/dev/null || true
  info "요약"
  printf "  KM_REQUIREMENTS_MODE=%s\n" "$KM_REQUIREMENTS_MODE"
  printf "  KM_INSTALL_METADATA=%s\n" "$KM_INSTALL_METADATA"
}

clean_cache() {
  rm -rf "$CACHE_DIR"
  mkdir -p "$CACHE_DIR"
  info "의존성 동기화 캐시 초기화 완료"
}

usage() {
  cat <<'EOF'
사용법:
  ./scripts/dev_fast.sh deps        # 변경된 의존성만 설치
  ./scripts/dev_fast.sh up          # deps + docker compose up -d
  ./scripts/dev_fast.sh down        # docker compose down
  ./scripts/dev_fast.sh status      # 캐시/설정 상태 확인
  ./scripts/dev_fast.sh clean-cache # 캐시 초기화

환경변수:
  KM_REQUIREMENTS_MODE=docker|full  (기본: docker)
  KM_INSTALL_METADATA=0|1           (기본: 0)

예시:
  ./scripts/dev_fast.sh up
  KM_REQUIREMENTS_MODE=full ./scripts/dev_fast.sh deps
  KM_INSTALL_METADATA=1 ./scripts/dev_fast.sh deps
EOF
}

main() {
  local cmd="${1:-up}"
  case "$cmd" in
    deps) deps ;;
    up) up ;;
    down) down ;;
    status) status ;;
    clean-cache) clean_cache ;;
    help|-h|--help) usage ;;
    *) err "알 수 없는 명령: $cmd"; usage; exit 1 ;;
  esac
}

main "$@"
