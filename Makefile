##############################################################################
##  ArchTask-Pro GUI — Makefile (Wails v2 + React)
##############################################################################

BINARY     := archtask-pro
DESTDIR    ?= /usr/local/bin
POLKIT_DIR := /usr/share/polkit-1/rules.d
GO         := go
WAILS      := wails

.PHONY: all dev build install uninstall clean polkit deps fmt help

##── Default: dev mode ────────────────────────────────────────────────────────
all: deps dev

##── Install Wails CLI if missing ─────────────────────────────────────────────
install-wails:
	@command -v wails >/dev/null 2>&1 || \
		$(GO) install github.com/wailsapp/wails/v2/cmd/wails@latest
	@echo "✓ Wails CLI ready"

##── Install all dependencies ─────────────────────────────────────────────────
deps: install-wails
	@echo "→ Go dependencies…"
	$(GO) mod tidy
	@echo "→ Node dependencies…"
	cd frontend && npm install
	@echo "✓ Dependencies ready"

##── Dev mode: hot-reload (Go + Vite) ─────────────────────────────────────────
dev:
	@echo "→ Starting dev server…"
	$(WAILS) dev

##── Production build ─────────────────────────────────────────────────────────
build:
	@echo "→ Building production binary…"
	$(WAILS) build -clean -o $(BINARY)
	@echo "✓ Binary: ./build/bin/$(BINARY)"

##── Build with debug symbols ─────────────────────────────────────────────────
build-debug:
	$(WAILS) build -debug -o $(BINARY)-debug

##── Install system-wide ──────────────────────────────────────────────────────
install: build
	install -Dm755 build/bin/$(BINARY) $(DESTDIR)/$(BINARY)
	@echo "✓ Installed to $(DESTDIR)/$(BINARY)"

##── Install polkit rules (passwordless cpupower + systemctl) ─────────────────
polkit:
	install -Dm644 polkit/10-archtask-pro.rules \
		$(POLKIT_DIR)/10-archtask-pro.rules
	@echo "✓ Polkit rule installed"

##── Uninstall ────────────────────────────────────────────────────────────────
uninstall:
	rm -f $(DESTDIR)/$(BINARY)
	rm -f $(POLKIT_DIR)/10-archtask-pro.rules
	@echo "✓ Uninstalled"

##── Format Go code ───────────────────────────────────────────────────────────
fmt:
	$(GO) fmt ./...

##── Clean build artifacts ────────────────────────────────────────────────────
clean:
	rm -rf build/
	$(GO) clean -cache
	@echo "✓ Clean"

##── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ArchTask-Pro GUI Build System (Wails v2)"
	@echo ""
	@echo "  make deps          — install Wails CLI + Go & Node deps"
	@echo "  make dev           — hot-reload dev mode"
	@echo "  make build         — production build"
	@echo "  make install       — install binary to $(DESTDIR)"
	@echo "  make polkit        — install polkit rule (run as root)"
	@echo "  make uninstall     — remove binary + polkit rule"
	@echo "  make clean         — remove build artifacts"
	@echo ""
	@echo "  Quick start:"
	@echo "    make deps && make dev"
	@echo ""
	@echo "  Full install:"
	@echo "    make build && make install && sudo make polkit"
	@echo ""
