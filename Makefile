.PHONY: setup setup-gpu dev backend frontend test lint clean

setup:
	./scripts/setup.sh

setup-gpu:
	./scripts/setup_gpu.sh

dev:
	./scripts/dev.sh

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest -q

lint:
	cd backend && uv run ruff check .

clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist
