function normalizeText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function ensurePunctuation(text) {
  const t = String(text || "").trim();
  if (!t) return t;
  return /[.!?,;:]$/.test(t) ? t : `${t},`;
}

// Mirrors KittenTTS 0.8.1 onnx_model.chunk_text behavior.
export function splitTextIntoChunks(text, maxChars = 400) {
  const input = String(text || "");
  if (!input.trim()) return [];
  const sentences = input.split(/[.!?]+/).filter(Boolean);
  const out = [];

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= maxChars) {
      out.push(ensurePunctuation(s));
      continue;
    }

    const words = s.split(/\s+/).filter(Boolean);
    let temp = "";
    for (const word of words) {
      const candidate = temp ? `${temp} ${word}` : word;
      if (candidate.length <= maxChars) {
        temp = candidate;
      } else {
        if (temp) out.push(ensurePunctuation(temp));
        temp = word;
      }
    }
    if (temp) {
      out.push(ensurePunctuation(temp));
    }
  }

  if (out.length) return out;
  if (input.length <= maxChars) return [ensurePunctuation(input)];
  // Fallback for text without clear sentence boundaries.
  const words = input.split(/\s+/).filter(Boolean);
  let temp = "";
  for (const word of words) {
    const candidate = temp ? `${temp} ${word}` : word;
    if (candidate.length <= maxChars) {
      temp = candidate;
    } else {
      if (temp) out.push(ensurePunctuation(temp));
      temp = word;
    }
  }
  if (temp) out.push(ensurePunctuation(temp));
  return out;
}

function encodeWithSymbolMap(text, cfg) {
  const symbols = Array.isArray(cfg.symbols) ? cfg.symbols : [];
  if (symbols.length === 0) {
    throw new Error(
      "tokenizer.preprocessMode is symbol_map but symbols list is empty. Populate symbols.json with Kitten-compatible tokens."
    );
  }
  const normalizedText =
    cfg.symbolMapTokenize === false
      ? text
      : (String(text).match(/[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu) || []).join(" ");
  const map = new Map(symbols.map((s, i) => [s, i]));
  const unk = cfg.unkToken ?? 0;
  return Array.from(normalizedText).map((ch) => map.get(ch) ?? unk);
}

function encodeBasic(text) {
  return Array.from(text).map((ch) => ch.codePointAt(0) % 255);
}

export function tokenizeText(text, tokenizerConfig = {}) {
  const cfg = tokenizerConfig || {};
  const maxLength = cfg.maxLength ?? 512;
  const preprocessMode = cfg.preprocessMode || "basic";
  const prefixTokens = Array.isArray(cfg.prefixTokens)
    ? cfg.prefixTokens
    : cfg.bosToken !== undefined
      ? [cfg.bosToken]
      : [1];
  const suffixTokens = Array.isArray(cfg.suffixTokens)
    ? cfg.suffixTokens
    : cfg.eosToken !== undefined
      ? [cfg.eosToken]
      : [2];

  let ids;
  if (preprocessMode === "symbol_map") {
    ids = encodeWithSymbolMap(text, cfg);
  } else {
    ids = encodeBasic(text);
  }

  const reserve = prefixTokens.length + suffixTokens.length;
  const body = ids.slice(0, Math.max(1, maxLength - reserve));
  return [...prefixTokens, ...body, ...suffixTokens];
}

export function prepareChunks(text, config) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const maxChunkChars = config?.maxChunkChars ?? 240;
  return splitTextIntoChunks(clean, maxChunkChars);
}
