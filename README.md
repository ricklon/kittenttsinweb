# KittenTTS Browser ONNX (Vite + Tailwind)

This project is configured for a **100% in-browser** KittenTTS flow:
- No Python backend
- No FastAPI
- ONNX Runtime Web in a worker
- IndexedDB asset caching
- Chunked generation for longer text

## Install and run

Use Node `>=20.19.0`.

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

## Dialogue script format

The Dialogue Panel accepts a structured script format:

```txt
[SPEAKER=EYE] The teacup has resigned.
[SPEAKER=MOUTH] Then appoint the umbrella.
[SPEAKER=EAR] It only speaks in buttons.
```

Rules:
- One line = one utterance
- `SPEAKER` is required in the bracket format
- Lines starting with `#` are treated as comments
- Blank lines are ignored

Backward compatibility:
- Legacy lines like `EYE: The teacup has resigned.` are still supported.

Voice mapping behavior:
- Speakers are mapped by first appearance:
  - speaker #1 -> Voice A
  - speaker #2 -> Voice B
  - speaker #3 -> Voice A
  - speaker #4 -> Voice B

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

## Model transparency and selection notes

When evaluating this TTS stack for production, separate two questions:
- How the model is run/integrated
- How the model was trained and documented

Current KittenTTS public materials provide strong usage guidance, but only partial training-data transparency.
At the time of writing, public docs explain architecture and usage, while detailed dataset composition/licensing details are not fully spelled out in one definitive place.

Implication for adopters:
- You can validate runtime behavior and quality in this repo.
- You should still perform your own policy/legal/compliance review before broad deployment.

## How Kitten-style input is interpreted

For this browser implementation, speaking behavior is driven by:
- Text preprocessing and chunking
- Phonemizer mode (`espeak_js`, `simple_en`, etc.)
- Token mapping (`symbol_map` + `symbols.json`)
- Voice embedding selection (`voices.npz`)
- Speed control

In practice:
- Punctuation changes rhythm and pauses.
- Numbers and dates are interpretation-sensitive (format matters).
- Acronyms can be spoken as words or letter-by-letter depending on text form.
- Different voices may pronounce edge cases differently.

## What users can and cannot expect

What works well:
- Fast browser-only inference (no Python backend).
- General English narration and short dialogue.
- A/B voice comparisons and whole-scene compilation.

Current constraints:
- Not full parity with the complete Python pipeline.
- Specialized domains (dense STEM notation, chemical names, code-like text) may need authoring tweaks.
- WebGPU remains experimental by browser/hardware; WASM is the reliable default.

## Authoring guide for clearer speech

Use this style for best intelligibility:
- Keep utterances short (one sentence per line where possible).
- Write dialogue as one speaker line per utterance.
- Prefer explicit punctuation over long comma chains.
- Rewrite ambiguous tokens into speakable forms.

### Dialogue formatting

Preferred:

```txt
[SPEAKER=HOST] Welcome to the test.
[SPEAKER=GUEST] Thanks, I will explain the results.
```

Also supported:

```txt
HOST: Welcome to the test.
GUEST: Thanks, I will explain the results.
```

### Dates, times, and numbers

Prefer explicit, human-readable forms:
- `2026-03-02` -> `March 2, 2026`
- `03/04/26` (ambiguous) -> `March 4, 2026` or `April 3, 2026` (pick one explicitly)
- `8:30pm` -> `8:30 p.m.`
- `$1250` -> `$1,250`

### STEM and technical text

For formulas/symbol-heavy lines, write a spoken version:
- `H2O` -> `H two O`
- `CO2` -> `C O two` or `carbon dioxide`
- `x^2` -> `x squared`
- `Δv` -> `delta v`
- `GPU/CPU` -> `G P U slash C P U` if letter clarity is important

For critical output, run a quick shootout pass and keep the best-scoring phrasing/voice pair.

## Sources used for these notes

- KittenTTS repository: `https://github.com/KittenML/KittenTTS`
- KittenTTS README: `https://raw.githubusercontent.com/KittenML/KittenTTS/main/README.md`
- KittenTTS ONNX path: `https://raw.githubusercontent.com/KittenML/KittenTTS/main/kittentts/onnx_model.py`
- KittenTTS model wrapper: `https://raw.githubusercontent.com/KittenML/KittenTTS/main/kittentts/get_model.py`
