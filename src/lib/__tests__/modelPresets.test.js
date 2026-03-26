import { describe, expect, it } from "vitest";
import { buildModelPresets, findModelPreset } from "../modelPresets";

describe("modelPresets", () => {
  it("builds preset URLs relative to the app base path", () => {
    const presets = buildModelPresets("/demo/");
    expect(presets[0]).toMatchObject({
      key: "nano-int8",
      modelDir: "/demo/models/kitten-tts-nano-0.8-int8",
      configUrl: "/demo/models/kitten-tts-nano-0.8-int8/browser-config.json"
    });
  });

  it("matches presets by model and config paths", () => {
    const presets = buildModelPresets("/");
    expect(findModelPreset("/models/kitten-tts-nano-0.8", "/models/kitten-tts-nano-0.8/browser-config.json", presets))
      .toMatchObject({ key: "nano" });
  });
});
