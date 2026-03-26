# Repository Guidelines

## Project Structure & Module Organization
This is a Vite + React browser app for KittenTTS. Application entry points live in `src/main.jsx` and `src/App.jsx`. Core synthesis and text-processing logic lives in `src/lib/`, with tests beside that code in `src/lib/__tests__/`. The worker that runs ONNX Runtime Web lives in `src/workers/tts.worker.js`. Static browser assets and model configuration live in `public/`, especially `public/models/kitten-tts-nano-0.8-int8/` and `public/phonemizer/`. Utility scripts belong in `scripts/`.

## Build, Test, and Development Commands
Use Node `>=20.19.0` to match the current Vite toolchain and CI.

- `npm install` installs dependencies.
- `./scripts/fetch-models.sh` downloads `model.onnx` and `voices.npz` into `public/models/kitten-tts-nano-0.8-int8/`.
- `npm run dev` starts the Vite dev server at `http://127.0.0.1:5173`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally.
- `npm test` runs Vitest once in CI-style mode.

## Coding Style & Naming Conventions
Follow the existing code style: 2-space indentation, double quotes, and semicolons. Use PascalCase for React components, camelCase for functions and state variables, and descriptive module names such as `textPipeline.js` and `kittenOnnx.js`. Keep tests named `*.test.js`. Prefer small, pure helpers in `src/lib/`; keep UI orchestration in `src/App.jsx`; keep browser-worker concerns in `src/workers/`.

## Testing Guidelines
Vitest is the test runner. Add or update tests whenever you change parsing, chunking, tokenization, or other logic in `src/lib/`. Place tests in `src/lib/__tests__/` and mirror the target module name, for example `dialogue.test.js`. Before opening a PR, run `npm test` and `npm run build`.

## Commit & Pull Request Guidelines
Recent history follows scoped conventional-style subjects such as `feat: ...`, `fix: ...`, `ui: ...`, and `docs: ...`. Keep commits focused and use the smallest meaningful scope. PRs should include a short problem/solution summary, note any model or config changes, link related issues, and include screenshots or short recordings for UI changes.

## Assets, Config, and Deployment
Do not hand-edit downloaded model binaries. Use `scripts/fetch-models.sh` instead. Keep `browser-config.json`, `symbols.json`, and `lexicon.json` in sync with runtime changes. GitHub Actions builds, tests, and deploys Pages from `main`, so avoid changes that break `npm run build` without updating the workflow.
