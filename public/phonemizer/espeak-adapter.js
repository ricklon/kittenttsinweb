// Drop-in adapter contract for BrowserPhonemizer espeak_js mode.
// Replace this implementation with a real espeak/phonemizer.js runtime.
// Required contract:
//   export async function createPhonemizer(config) {
//     return { async phonemize(text) { return "..."; } };
//   }

export async function createPhonemizer(config = {}) {
  const language = config.language || "en-us";

  return {
    async phonemize(text) {
      // Placeholder passthrough to keep the pipeline runnable by default.
      // Replace with true phoneme output expected by your symbol map.
      const normalized = String(text || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      return normalized;
    },
    language
  };
}
