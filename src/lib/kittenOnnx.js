import * as ort from "onnxruntime-web";
import { loadNpzFromArrayBuffer } from "./npz";
import { BrowserPhonemizer } from "./phonemizer";
import { prepareChunks, tokenizeText } from "./textPipeline";

const DEFAULT_VOICES = ["Bella", "Jasper", "Luna", "Bruno", "Rosie", "Hugo", "Kiki", "Leo"];

function toBigInt64Array(values) {
  const out = new BigInt64Array(values.length);
  for (let i = 0; i < values.length; i += 1) out[i] = BigInt(values[i]);
  return out;
}

function normalizeVoiceEntries(npzEntries) {
  const keys = Object.keys(npzEntries);
  if (keys.length === 0) return {};

  if (npzEntries.arr_0?.data && npzEntries.names?.data) {
    const arr = npzEntries.arr_0;
    const names = Array.from(npzEntries.names.data, (n) => String(n));
    const dim = arr.shape[1];
    const voices = {};
    for (let i = 0; i < names.length; i += 1) {
      const start = i * dim;
      const end = start + dim;
      voices[names[i]] = {
        data: new Float32Array(arr.data.slice(start, end)),
        shape: [1, dim]
      };
    }
    return voices;
  }

  const voices = {};
  for (const [key, value] of Object.entries(npzEntries)) {
    if (value?.data) {
      voices[key] = {
        data: new Float32Array(value.data),
        shape: Array.isArray(value.shape) ? value.shape : [value.data.length]
      };
    }
  }
  return voices;
}

function selectVoiceStyleTensor(voiceEntry, textLength) {
  if (!voiceEntry?.data) throw new Error("Invalid voice embedding entry.");
  const shape = Array.isArray(voiceEntry.shape) ? voiceEntry.shape : [voiceEntry.data.length];

  // Common Kitten format: [num_refs, 256]. Choose one row like Python reference implementation.
  if (shape.length === 2) {
    const rows = shape[0];
    const cols = shape[1];
    if (!rows || !cols) throw new Error(`Invalid 2D voice shape: ${shape.join("x")}`);
    const refId = Math.min(Math.max(0, textLength), rows - 1);
    const start = refId * cols;
    const end = start + cols;
    return {
      data: voiceEntry.data.slice(start, end),
      tensorShape: [1, cols]
    };
  }

  // Already a single vector.
  if (shape.length === 1) {
    return {
      data: voiceEntry.data,
      tensorShape: [1, voiceEntry.data.length]
    };
  }

  throw new Error(`Unsupported voice embedding shape: ${shape.join("x")}`);
}

function pickInputName(session, preferred, alternatives = []) {
  const names = session.inputNames || [];
  if (preferred && names.includes(preferred)) return preferred;
  for (const alt of alternatives) {
    if (names.includes(alt)) return alt;
  }
  return null;
}

function sanitizeAudio(floatArray) {
  const out = new Float32Array(floatArray.length);
  let peak = 0;
  for (let i = 0; i < floatArray.length; i += 1) {
    const v = Number.isFinite(floatArray[i]) ? floatArray[i] : 0;
    out[i] = v;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
  }
  const targetPeak = 0.95;
  if (peak > 1e-6) {
    const gain = peak > targetPeak ? targetPeak / peak : Math.min(8, targetPeak / peak);
    for (let i = 0; i < out.length; i += 1) out[i] *= gain;
  }
  return out;
}

function trimTailSamples(floatArray, trimSamples = 0) {
  if (!trimSamples || trimSamples <= 0) return floatArray;
  if (floatArray.length <= trimSamples + 1) return floatArray;
  return floatArray.slice(0, floatArray.length - trimSamples);
}

function concatFloat32(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export class KittenOnnxEngine {
  constructor() {
    this.session = null;
    this.config = null;
    this.voices = {};
    this.availableVoices = DEFAULT_VOICES;
    this.phonemizer = new BrowserPhonemizer({ mode: "none" });
  }

  async init(options = {}) {
    const modelDir = options.modelDir || "/models/kitten-tts-nano-0.8-int8";
    const config = options.configObject;
    this.config = config || {};
    if (!this.config.tokenizer) this.config.tokenizer = {};
    if (Array.isArray(options.symbols)) {
      this.config.tokenizer.symbols = options.symbols;
      if (!this.config.tokenizer.preprocessMode) {
        this.config.tokenizer.preprocessMode = "symbol_map";
      }
    }
    this.phonemizer = new BrowserPhonemizer(this.config.phonemizer || { mode: "none" });
    await this.phonemizer.init(options.lexicon || null);

    ort.env.wasm.wasmPaths = options.wasmPaths || "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
    ort.env.wasm.numThreads = options.numThreads ?? 1;
    ort.env.wasm.simd = true;

    const providers = options.providers || config.providers || ["wasm"];
    const modelFile = config.modelFile || "model.onnx";
    const modelBytes = options.modelBytes;

    this.session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: providers,
      graphOptimizationLevel: "all",
      enableCpuMemArena: true,
      enableMemPattern: true
    });

    const voicesBytes = options.voicesBytes;
    const npzEntries = await loadNpzFromArrayBuffer(voicesBytes);
    this.voices = normalizeVoiceEntries(npzEntries);
    const names = Object.keys(this.voices);
    if (names.length > 0) this.availableVoices = names;

    return {
      modelDir,
      modelFile,
      providers,
      inputs: this.session.inputNames,
      outputs: this.session.outputNames,
      voiceCount: this.availableVoices.length,
      voices: this.availableVoices
    };
  }

  async generate(text, options = {}) {
    if (!this.session || !this.config) throw new Error("Model is not initialized.");
    const chunks = prepareChunks(text || "", this.config);
    if (chunks.length === 0) throw new Error("Text cannot be empty.");

    const cfg = this.config;
    const inputNames = cfg.inputNames || {};
    const outputNames = cfg.outputNames || {};
    const voiceName = options.voice || cfg.defaultVoice || this.availableVoices[0];
    const speed = options.speed ?? 1.0;

    const voiceEmbedding = this.voices[voiceName];
    if (!voiceEmbedding) throw new Error(`Voice "${voiceName}" not found in voice embeddings.`);

    const tokenInput = pickInputName(this.session, inputNames.tokens, ["input_ids", "tokens", "text_tokens"]);
    const lengthInput = pickInputName(this.session, inputNames.lengths, ["input_lengths", "text_lengths"]);
    const voiceInput = pickInputName(this.session, inputNames.voice, [
      "speaker_embedding",
      "style",
      "voice",
      "speaker",
      "speaker_embeddings"
    ]);
    const speedInput = pickInputName(this.session, inputNames.speed, ["speed", "alpha", "rate"]);
    const audioOutput = outputNames.audio || this.session.outputNames[0];

    if (!tokenInput) throw new Error(`No token input found. ONNX inputs: ${this.session.inputNames.join(", ")}`);

    const rendered = [];
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const onChunkAudio = typeof options.onChunkAudio === "function" ? options.onChunkAudio : null;
    const sampleRate = cfg.sampleRate || 24000;
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      if (onProgress) {
        onProgress({
          stage: "chunk_start",
          current: i + 1,
          total: chunks.length
        });
      }
      const prepared = await this.phonemizer.apply(chunk);
      const tokenIds = tokenizeText(prepared, cfg.tokenizer);
      const seqLen = tokenIds.length;

      const feeds = {};
      feeds[tokenInput] = new ort.Tensor("int64", toBigInt64Array(tokenIds), [1, seqLen]);
      if (lengthInput) {
        feeds[lengthInput] = new ort.Tensor("int64", new BigInt64Array([BigInt(seqLen)]), [1]);
      }
      if (voiceInput) {
        const style = selectVoiceStyleTensor(voiceEmbedding, chunk.length);
        feeds[voiceInput] = new ort.Tensor("float32", style.data, style.tensorShape);
      }
      if (speedInput) {
        feeds[speedInput] = new ort.Tensor("float32", new Float32Array([speed]), [1]);
      }

      const outputMap = await this.session.run(feeds);
      const out = outputMap[audioOutput] || outputMap[Object.keys(outputMap)[0]];
      if (!out?.data) throw new Error("Model output did not contain audio tensor data.");
      const trim = Number(cfg.trimTailSamples ?? 5000);
      const raw = new Float32Array(out.data);
      const chunkAudio = sanitizeAudio(trimTailSamples(raw, trim));
      rendered.push(chunkAudio);
      if (onChunkAudio) {
        onChunkAudio({
          audio: chunkAudio,
          sampleRate,
          chunkIndex: i,
          totalChunks: chunks.length,
          text: chunk
        });
      }
      if (onProgress) {
        onProgress({
          stage: "chunk_done",
          current: i + 1,
          total: chunks.length
        });
      }
    }

    return {
      sampleRate,
      audio: concatFloat32(rendered),
      chunks: chunks.length
    };
  }
}
