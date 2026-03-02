function normalizeForSimpleEn(text) {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[@]/g, " at ")
    .replace(/\d+/g, (n) => numberToWords(n))
    .replace(/[^a-z'.,!?;:\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberToWords(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n < 0 || n > 9999) return String(n);

  const small = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen"
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  if (n < 20) return small[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${small[n % 10]}` : ""}`;
  if (n < 1000) {
    const r = n % 100;
    return `${small[Math.floor(n / 100)]} hundred${r ? ` ${numberToWords(r)}` : ""}`;
  }
  const r = n % 1000;
  return `${small[Math.floor(n / 1000)]} thousand${r ? ` ${numberToWords(r)}` : ""}`;
}

function applyWordMap(text, lexicon, fallbackMode = "keep") {
  if (!lexicon || typeof lexicon !== "object") return text;
  const words = text.split(/\s+/).filter(Boolean);
  const mapped = words.map((w) => {
    const key = w.toLowerCase();
    if (typeof lexicon[key] === "string") return lexicon[key];
    if (fallbackMode === "drop") return "";
    return w;
  });
  return mapped.join(" ").replace(/\s+/g, " ").trim();
}

function resolveModuleUrl(modulePath) {
  if (!modulePath) return null;
  if (/^https?:\/\//.test(modulePath) || modulePath.startsWith("/")) return modulePath;
  return `/${modulePath.replace(/^\.\//, "")}`;
}

async function loadExternalAdapter(moduleUrl, config) {
  const loaded = await import(/* @vite-ignore */ moduleUrl);
  if (typeof loaded?.createPhonemizer !== "function") {
    throw new Error(`Phonemizer adapter module must export createPhonemizer(config): ${moduleUrl}`);
  }
  const adapter = await loaded.createPhonemizer(config);
  if (!adapter || typeof adapter.phonemize !== "function") {
    throw new Error(`Phonemizer adapter must return { phonemize(text) }: ${moduleUrl}`);
  }
  return adapter;
}

async function loadBuiltinEspeakAdapter(config) {
  const mod = await import("phonemizer");
  if (typeof mod?.phonemize !== "function") {
    throw new Error('The "phonemizer" package did not expose phonemize(text, language).');
  }
  const language = config.language || "en-us";
  return {
    async phonemize(text) {
      const lines = await mod.phonemize(text, language);
      if (!Array.isArray(lines)) return "";
      return lines.join(" ").replace(/\s+/g, " ").trim();
    }
  };
}

export class BrowserPhonemizer {
  constructor(config = {}) {
    this.config = config || {};
    this.lexicon = null;
    this.adapter = null;
    this.mode = this.config.mode || "none";
  }

  async init(lexicon) {
    this.lexicon = lexicon && typeof lexicon === "object" ? lexicon : null;
    if (this.mode !== "espeak_js") return;

    if (this.config.adapterModule) {
      const moduleUrl = resolveModuleUrl(this.config.adapterModule);
      if (!moduleUrl) {
        throw new Error("Invalid phonemizer.adapterModule path.");
      }
      this.adapter = await loadExternalAdapter(moduleUrl, this.config);
      return;
    }

    this.adapter = await loadBuiltinEspeakAdapter(this.config);
  }

  async apply(text) {
    const input = String(text || "");
    if (!input.trim()) return "";

    if (this.mode === "none") return input;

    if (this.mode === "simple_en") {
      return normalizeForSimpleEn(input);
    }

    if (this.mode === "word_map") {
      const normalized = normalizeForSimpleEn(input);
      return applyWordMap(normalized, this.lexicon, this.config.fallback || "keep");
    }

    if (this.mode === "espeak_js") {
      if (!this.adapter) {
        throw new Error("espeak_js mode selected but adapter is not initialized.");
      }
      const out = await this.adapter.phonemize(input);
      if (typeof out !== "string") {
        throw new Error("Phonemizer adapter returned non-string output.");
      }
      return out;
    }

    return input;
  }
}
