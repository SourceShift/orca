# Co-Evolve stack — one command for the whole loop.
#
#   make dev      bring up ContextNest + mini-ork + Orca, in dependency order
#   make status   what is up, what is not
#   make stop     tear down the backends we started (never touches your editors)
#   make logs     tail everything
#
# Run from the Orca repo root: `make dev` (the root Makefile delegates here).
#
# Design notes worth knowing:
#  - Services are checked by PORT, not by process name. A service someone else
#    started is REUSED, never double-started or killed.
#  - `make stop` only kills what THIS Makefile started (it records pids). It will
#    not kill a ContextNest you are running in another terminal.
#  - Orca needs node <25 (package.json devEngines: >=22.13 <25). We locate a
#    suitable node and fail loudly if there isn't one, rather than letting the
#    main-process build die with a confusing error.

SHELL := /bin/bash
.ONESHELL:

MINIORK   ?= /Volumes/docker-ssd/ps/mini-ork
CONTEXTNEST ?= $(HOME)/ps/ContextNest
ORCA      := $(shell git rev-parse --show-toplevel 2>/dev/null || pwd)

MINIORK_PORT ?= 7090
CN_PORT      ?= 28080

RUN := $(ORCA)/coevolve/.run
LOGS := $(RUN)/logs

# ── node <25 discovery (Orca pins >=22.13 <25; many machines default to 25+) ──
NODE_BIN := $(shell \
  for c in $$(ls -d $$HOME/.nvm/versions/node/v2[2-4].* 2>/dev/null | sort -V -r) \
           /opt/homebrew/opt/node@22 /opt/homebrew/opt/node@24 ; do \
    if [ -x "$$c/bin/node" ]; then echo "$$c/bin"; break; fi; \
  done)

# If the default node is already in range, just use it.
NODE_OK := $(shell node -e 'const [M]=process.versions.node.split(".").map(Number); process.exit(M>=22 && M<25 ? 0 : 1)' 2>/dev/null && echo yes)

ifeq ($(NODE_OK),yes)
  NODE_PATH_PREFIX :=
else
  NODE_PATH_PREFIX := $(NODE_BIN):
endif

GREEN := \033[32m
RED   := \033[31m
DIM   := \033[2m
OFF   := \033[0m

.PHONY: dev status stop logs check-node up-cn up-miniork up-orca

## dev: bring up the whole loop (ContextNest → mini-ork → Orca)
dev: check-node up-cn up-miniork
	@echo ""
	@$(MAKE) --no-print-directory status
	@echo ""
	@echo -e "$(DIM)Starting Orca (foreground — Ctrl-C stops it; backends keep running).$(OFF)"
	@echo -e "$(DIM)Backends: 'make stop' to tear down, 'make logs' to tail.$(OFF)"
	@echo ""
	@cd $(ORCA) && PATH="$(NODE_PATH_PREFIX)$$PATH" pnpm dev

## check-node: Orca's build dies confusingly on node >=25 — fail clearly instead
check-node:
	@if [ "$(NODE_OK)" = "yes" ]; then \
	  echo -e "$(GREEN)✓$(OFF) node $$(node -v) (Orca needs >=22.13 <25)"; \
	elif [ -n "$(NODE_BIN)" ]; then \
	  echo -e "$(GREEN)✓$(OFF) node $$($(NODE_BIN)/node -v) via $(NODE_BIN) $(DIM)(default $$(node -v) is out of range)$(OFF)"; \
	else \
	  echo -e "$(RED)✗$(OFF) No node in [22.13, 25) found. Orca's main-process build will fail."; \
	  echo "  Install one:  nvm install 22.23.1   (or: brew install node@22)"; \
	  exit 1; \
	fi

## up-cn: start ContextNest (:28080) unless something already answers there
up-cn:
	@mkdir -p $(LOGS)
	@if curl -sf -m 2 http://127.0.0.1:$(CN_PORT)/api/health >/dev/null 2>&1; then \
	  echo -e "$(GREEN)✓$(OFF) ContextNest already up on :$(CN_PORT) $(DIM)(reusing — not restarting)$(OFF)"; \
	else \
	  echo -n "  starting ContextNest… "; \
	  ( cd $(CONTEXTNEST) && nohup make dev-be > $(LOGS)/contextnest.log 2>&1 & ); \
	  for i in $$(seq 1 90); do \
	    curl -sf -m 1 http://127.0.0.1:$(CN_PORT)/api/health >/dev/null 2>&1 && break; \
	    sleep 1; \
	  done; \
	  if curl -sf -m 2 http://127.0.0.1:$(CN_PORT)/api/health >/dev/null 2>&1; then \
	    lsof -ti :$(CN_PORT) > $(RUN)/cn.pid 2>/dev/null || true; \
	    echo -e "$(GREEN)ok$(OFF)"; \
	  else \
	    echo -e "$(RED)FAILED$(OFF) — see $(LOGS)/contextnest.log"; \
	    echo -e "$(DIM)  (first cargo build can exceed 90s; re-run make dev)$(OFF)"; \
	    exit 1; \
	  fi; \
	fi

## up-miniork: start mini-ork serve (:7090) unless something already answers there
up-miniork:
	@mkdir -p $(LOGS)
	@if curl -sf -m 2 http://127.0.0.1:$(MINIORK_PORT)/api/v1/health >/dev/null 2>&1; then \
	  echo -e "$(GREEN)✓$(OFF) mini-ork already up on :$(MINIORK_PORT) $(DIM)(reusing — not restarting)$(OFF)"; \
	else \
	  echo -n "  starting mini-ork serve… "; \
	  ( cd $(MINIORK) && nohup bin/mini-ork serve --port $(MINIORK_PORT) > $(LOGS)/miniork.log 2>&1 & ); \
	  for i in $$(seq 1 30); do \
	    curl -sf -m 1 http://127.0.0.1:$(MINIORK_PORT)/api/v1/health >/dev/null 2>&1 && break; \
	    sleep 1; \
	  done; \
	  if curl -sf -m 2 http://127.0.0.1:$(MINIORK_PORT)/api/v1/health >/dev/null 2>&1; then \
	    lsof -ti :$(MINIORK_PORT) > $(RUN)/mo.pid 2>/dev/null || true; \
	    echo -e "$(GREEN)ok$(OFF)"; \
	  else \
	    echo -e "$(RED)FAILED$(OFF) — see $(LOGS)/miniork.log"; exit 1; \
	  fi; \
	fi

## status: what's up. Probes the PORT — the only thing the panel actually cares about.
status:
	@MINIORK_PORT=$(MINIORK_PORT) CN_PORT=$(CN_PORT) CONTEXTNEST=$(CONTEXTNEST) \
	  bash $(ORCA)/coevolve/status.sh

## stop: kill ONLY the backends this Makefile started. Never touches yours.
stop:
	@for f in $(RUN)/cn.pid $(RUN)/mo.pid; do \
	  [ -f "$$f" ] || continue; \
	  name=$$(basename $$f .pid); \
	  while read -r pid; do \
	    [ -n "$$pid" ] || continue; \
	    if kill -0 "$$pid" 2>/dev/null; then \
	      pkill -P "$$pid" 2>/dev/null || true; \
	      kill "$$pid" 2>/dev/null || true; \
	      sleep 0.3; \
	      kill -0 "$$pid" 2>/dev/null && kill -9 "$$pid" 2>/dev/null || true; \
	      echo "  stopped $$name (pid $$pid)"; \
	    fi; \
	  done < "$$f"; \
	  rm -f "$$f"; \
	done
	@echo -e "$(DIM)Services started outside this Makefile were left alone.$(OFF)"

## logs: tail everything we started
logs:
	@tail -f $(LOGS)/*.log 2>/dev/null || echo "no logs yet — run 'make dev'"
