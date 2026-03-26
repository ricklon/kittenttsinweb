import { KittenOnnxEngine } from "../lib/kittenOnnx";
import { DEFAULT_KITTEN_SYMBOLS, resolveKittenSymbols } from "../lib/kittenSymbols";
import {
  fetchArrayBufferCached,
  fetchArrayBufferFresh,
  fetchJsonFresh,
  invalidateCached
} from "../lib/cache";
import { encodeWavFromFloat32 } from "../lib/wav";

const engine = new KittenOnnxEngine();

function applyConfigOverrides(config, overrides) {
  if (!overrides || typeof overrides !== "object") return config;
  const next = structuredClone(config);
  if (typeof overrides.trimTailSamples === "number") {
    next.trimTailSamples = overrides.trimTailSamples;
  }
  if (typeof overrides.phonemizerMode === "string") {
    next.phonemizer = next.phonemizer || {};
    next.phonemizer.mode = overrides.phonemizerMode;
  }
  return next;
}

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};
  try {
    if (type === "init") {
      const modelDir = payload?.modelDir || "/models/kitten-tts-nano-0.8-int8";
      const configUrl = payload?.configUrl || `${modelDir}/browser-config.json`;
      const baseConfig = await fetchJsonFresh(configUrl);
      const config = applyConfigOverrides(baseConfig, payload?.configOverrides);
      const modelUrl = `${modelDir}/${config.modelFile || "model.onnx"}`;
      const voicesUrl = `${modelDir}/${config.voicesFile || "voices.npz"}`;
      const symbolsFile = config?.tokenizer?.symbolsFile;
      const symbolsUrl = symbolsFile ? `${modelDir}/${symbolsFile}` : null;
      const lexiconFile = config?.phonemizer?.lexiconFile;
      const lexiconUrl = lexiconFile ? `${modelDir}/${lexiconFile}` : null;
      const [modelBytes, voicesBytes] = await Promise.all([
        fetchArrayBufferCached(modelUrl),
        fetchArrayBufferCached(voicesUrl)
      ]);
      let symbols = null;
      let lexicon = null;
      if (symbolsUrl) {
        symbols = await fetchJsonFresh(symbolsUrl);
      }
      if (lexiconUrl) {
        lexicon = await fetchJsonFresh(lexiconUrl);
      }

      const usingBuiltinSymbols =
        config?.tokenizer?.preprocessMode === "symbol_map" && (!Array.isArray(symbols) || symbols.length === 0);
      const resolvedSymbols = usingBuiltinSymbols ? resolveKittenSymbols(symbols) : symbols;

      self.postMessage({
        type: "debug",
        payload: {
          configUrl,
          modelUrl,
          voicesUrl,
          symbolsUrl,
          lexiconUrl,
          symbolsCount: Array.isArray(resolvedSymbols) ? resolvedSymbols.length : null,
          usingBuiltinSymbols,
          preprocessMode: config?.tokenizer?.preprocessMode || "unknown",
          phonemizerMode: config?.phonemizer?.mode || "unknown",
          trimTailSamples: config?.trimTailSamples ?? null,
          providersRequested: payload?.providers || null
        }
      });

      let info;
      try {
        info = await engine.init({
          ...(payload || {}),
          configObject: config,
          modelBytes,
          voicesBytes,
          symbols: Array.isArray(resolvedSymbols) ? resolvedSymbols : null,
          lexicon: lexicon && typeof lexicon === "object" ? lexicon : null
        });
      } catch (err) {
        const msg = String(err?.message || err || "");
        if (!/protobuf|parse/i.test(msg)) throw err;

        await Promise.all([invalidateCached(modelUrl), invalidateCached(voicesUrl)]);
        const [freshModelBytes, freshVoicesBytes] = await Promise.all([
          fetchArrayBufferFresh(modelUrl),
          fetchArrayBufferFresh(voicesUrl)
        ]);
        info = await engine.init({
          ...(payload || {}),
          configObject: config,
          modelBytes: freshModelBytes,
          voicesBytes: freshVoicesBytes,
          symbols: Array.isArray(resolvedSymbols) ? resolvedSymbols : null,
          lexicon: lexicon && typeof lexicon === "object" ? lexicon : null
        });
      }
      self.postMessage({ type: "ready", payload: info });
      return;
    }

    if (type === "generate") {
      const { text, voice, speed, requestId, stream } = payload || {};
      self.postMessage({
        type: "progress",
        payload: {
          requestId: requestId || null,
          stage: "start",
          message: "Starting generation"
        }
      });
      const { audio, sampleRate, chunks } = await engine.generate(text, {
        voice,
        speed,
        onChunkAudio: stream
          ? async (chunk) => {
              const wavBlob = encodeWavFromFloat32(chunk.audio, chunk.sampleRate, 1);
              const wavBuffer = await wavBlob.arrayBuffer();
              self.postMessage(
                {
                  type: "audio_chunk",
                  payload: {
                    requestId: requestId || null,
                    sampleRate: chunk.sampleRate,
                    wavBuffer,
                    samples: chunk.audio.length,
                    chunkIndex: chunk.chunkIndex,
                    totalChunks: chunk.totalChunks,
                    text: chunk.text
                  }
                },
                [wavBuffer]
              );
            }
          : null,
        onProgress: (p) => {
          self.postMessage({
            type: "progress",
            payload: {
              requestId: requestId || null,
              stage: p.stage,
              current: p.current,
              total: p.total,
              message: `Rendering chunk ${p.current}/${p.total}`
            }
          });
        }
      });
      self.postMessage({
        type: "progress",
        payload: {
          requestId: requestId || null,
          stage: "encode",
          message: "Encoding WAV"
        }
      });
      const wavBlob = encodeWavFromFloat32(audio, sampleRate, 1);
      const wavBuffer = await wavBlob.arrayBuffer();
      self.postMessage(
        {
          type: "audio",
          payload: {
            requestId: requestId || null,
            voice: voice || null,
            sampleRate,
            wavBuffer,
            samples: audio.length,
            chunks
          }
        },
        [wavBuffer]
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: {
        requestId: payload?.requestId || null,
        message: String(error?.message || error)
      }
    });
  }
};
