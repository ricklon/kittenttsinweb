function normalizeText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function splitLongSegment(segment, maxChars) {
  const out = [];
  let i = 0;
  while (i < segment.length) {
    out.push(segment.slice(i, i + maxChars));
    i += maxChars;
  }
  return out;
}

export function splitTextIntoChunks(text, maxChars = 240) {
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    if (sentence.length > maxChars) {
      out.push(...splitLongSegment(sentence, maxChars));
      current = "";
    } else {
      current = sentence;
    }
  }

  if (current) out.push(current);
  return out.length ? out : splitLongSegment(text, maxChars);
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
