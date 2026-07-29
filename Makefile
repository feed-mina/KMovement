.PHONY: help dev-fast dev-fast-deps dev-fast-down dev-fast-status dev-fast-clean-cache dev-fast-full-deps dev-fast-meta-deps

help:
	@echo "Available targets:"
	@echo "  make dev-fast            # deps + docker compose up -d"
	@echo "  make dev-fast-deps       # install changed deps only"
	@echo "  make dev-fast-full-deps  # install full Python deps + Node deps"
	@echo "  make dev-fast-meta-deps  # include metadata-project deps"
	@echo "  make dev-fast-down       # docker compose down"
	@echo "  make dev-fast-status     # show dev-fast cache/status"
	@echo "  make dev-fast-clean-cache # reset dev-fast dependency cache"

# Team entrypoint: quick start with dependency change detection
dev-fast:
	@./scripts/dev_fast.sh up

dev-fast-deps:
	@./scripts/dev_fast.sh deps

dev-fast-full-deps:
	@KM_REQUIREMENTS_MODE=full ./scripts/dev_fast.sh deps

dev-fast-meta-deps:
	@KM_INSTALL_METADATA=1 ./scripts/dev_fast.sh deps

dev-fast-down:
	@./scripts/dev_fast.sh down

dev-fast-status:
	@./scripts/dev_fast.sh status

dev-fast-clean-cache:
	@./scripts/dev_fast.sh clean-cache
