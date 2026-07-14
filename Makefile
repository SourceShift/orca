# Co-Evolve — delegates to coevolve/Makefile.
#
# This is the ONLY file we add to Orca's root. Upstream has no Makefile and has not
# added one in 90 days, so this does not conflict on rebase. If upstream ever adds
# their own, git will report a both-added conflict — merge ours into theirs and keep
# the delegation. Everything real lives in coevolve/Makefile.
#
#   make dev      ContextNest + mini-ork + Orca, in dependency order
#   make status   what is up, with live counts
#   make stop     tear down only what we started
#   make logs     tail everything

.PHONY: dev status stop logs check-node up-cn up-miniork help

help:
	@echo "Co-Evolve stack:"
	@echo "  make dev      bring up ContextNest (:28080) + mini-ork (:7090) + Orca"
	@echo "  make status   what is running, with live counts"
	@echo "  make stop     stop the backends this Makefile started"
	@echo "  make logs     tail backend logs"

dev status stop logs check-node up-cn up-miniork:
	@$(MAKE) -f coevolve/Makefile $@
