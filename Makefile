.PHONY: setup help

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Full local dev setup (Node dependencies + Rust toolchain)
	@echo "==> Installing Node.js dependencies..."
	npm run setup
	@echo "==> Installing Rust/Soroban toolchain..."
	rustup target add wasm32v1-none 2>/dev/null || true
	@echo "==> Setup complete! Run 'make dev' to start development."
