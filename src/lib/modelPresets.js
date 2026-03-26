const MODEL_PRESET_DEFS = [
  {
    key: "nano-int8",
    slug: "kitten-tts-nano-0.8-int8",
    label: "Nano INT8",
    description: "Fastest default path. Smallest download, but upstream notes some int8 issues in some environments.",
    downloadArg: "nano-int8"
  },
  {
    key: "nano",
    slug: "kitten-tts-nano-0.8",
    label: "Nano FP32",
    description: "Stable fallback. Same general profile as nano INT8, with a larger model file.",
    downloadArg: "nano"
  },
  {
    key: "micro",
    slug: "kitten-tts-micro-0.8",
    label: "Micro FP32",
    description: "Higher quality preset for browser testing when a slower, larger model is acceptable.",
    downloadArg: "micro"
  }
];

function normalizeBaseUrl(baseUrl = "/") {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function buildModelPresets(baseUrl = "/") {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return MODEL_PRESET_DEFS.map((preset) => {
    const modelDir = `${normalizedBase}models/${preset.slug}`;
    return {
      ...preset,
      modelDir,
      configUrl: `${modelDir}/browser-config.json`
    };
  });
}

export function findModelPreset(modelDir, configUrl, presets) {
  return (
    presets.find((preset) => preset.modelDir === modelDir && preset.configUrl === configUrl) || null
  );
}
