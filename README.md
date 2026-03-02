# KittenTTS Browser ONNX (Vite + Tailwind)

This project is configured for a **100% in-browser** KittenTTS flow:
- No Python backend
- No FastAPI
- ONNX Runtime Web in a worker
- IndexedDB asset caching
- Chunked generation for longer text

## Install and run

```bash
npm install
./scripts/fetch-models.sh
npm run dev
```

Open `http://127.0.0.1:5173`.

## GitHub Pages demo

This repo includes a deploy workflow:
- [.github/workflows/pages.yml](/home/ra/Projects/kittenttsinweb/.github/workflows/pages.yml)

Expected demo URL:
- `https://ricklon.github.io/kittenttsinweb/`

One-time repo setting:
1. GitHub repo -> `Settings` -> `Pages`
2. `Build and deployment` source: `GitHub Actions`

## Model files required

Place model assets in:

`public/models/kitten-tts-nano-0.8-int8/`

Required files:
- `model.onnx`
- `voices.npz`
- `browser-config.json` (template already included)
- `symbols.json` (template included as empty array)
- `lexicon.json` (template included as empty object)

Important:
- `symbol_map` mode requires a real `symbols.json` token list. The placeholder `[]` will intentionally error at runtime.
- UI includes live A/B controls:
  - `Phonemizer Mode`: `espeak_js` vs `simple_en`
  - `Tail Trim`: trims end samples to reduce trailing artifacts
  - Re-click `Initialize Model` after changing either control.
- UI includes `Execution Mode`:
  - `WASM (Stable)`
  - `Auto (WebGPU then WASM)`
  - `WebGPU (Experimental)`

## One-command model download

```bash
./scripts/fetch-models.sh
```

This fetches:
- `public/models/kitten-tts-nano-0.8-int8/model.onnx`
- `public/models/kitten-tts-nano-0.8-int8/voices.npz`

## Browser config

File: [public/models/kitten-tts-nano-0.8-int8/browser-config.json](/home/ra/Projects/kittenttsinweb/public/models/kitten-tts-nano-0.8-int8/browser-config.json)

You may need to adjust:
- `inputNames.*` to match your ONNX graph input names
- `outputNames.audio` to match output tensor name
- `tokenizer.preprocessMode`:
  - `basic` uses fallback char encoding
  - `symbol_map` uses `symbols.json` token lookup
- `phonemizer.mode`:
  - `none`: no phonemizer transform
  - `simple_en`: light text normalization + number expansion
  - `word_map`: normalize + per-word mapping from `lexicon.json`
  - `espeak_js`: uses `phonemizer` package (eSpeak NG in browser)

Use Netron to inspect model I/O names if generation errors mention missing tensors.

## Current implementation notes

- Worker entry: [src/workers/tts.worker.js](/home/ra/Projects/kittenttsinweb/src/workers/tts.worker.js)
- ONNX engine: [src/lib/kittenOnnx.js](/home/ra/Projects/kittenttsinweb/src/lib/kittenOnnx.js)
- NPZ loader: [src/lib/npz.js](/home/ra/Projects/kittenttsinweb/src/lib/npz.js)
- WAV encoder: [src/lib/wav.js](/home/ra/Projects/kittenttsinweb/src/lib/wav.js)
- UI: [src/App.jsx](/home/ra/Projects/kittenttsinweb/src/App.jsx)

Important:
- Input names are auto-detected with config overrides (supports `speaker_embedding` or `style` style inputs).
- Audio is sanitized (NaN-safe + peak normalization) before WAV encoding.
- Text preprocessing/tokenization supports:
  - fallback mode (`basic`)
  - symbol-map mode (`symbol_map` + `symbols.json`)
- Phonemizer layer supports:
  - `none`, `simple_en`, `word_map` (`lexicon.json`), `espeak_js`

Optional custom adapter override:
- [public/phonemizer/espeak-adapter.js](/home/ra/Projects/kittenttsinweb/public/phonemizer/espeak-adapter.js)
- Set `phonemizer.adapterModule` in config to use this instead of built-in `phonemizer`.

## Parity gap vs full Kitten pipeline

To match the deep-dive quality path, still add:
- broader text preprocessor parity with Kitten Python preprocessing steps
- WebGPU quality/perf validation across browsers and hardware
