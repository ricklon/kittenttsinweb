import { describe, expect, it } from "vitest";
import { DEFAULT_KITTEN_SYMBOLS, resolveKittenSymbols } from "../kittenSymbols";

describe("kittenSymbols", () => {
  it("falls back to the upstream KittenTTS symbol table when symbols are empty", () => {
    expect(resolveKittenSymbols([])).toEqual(DEFAULT_KITTEN_SYMBOLS);
    expect(DEFAULT_KITTEN_SYMBOLS.length).toBeGreaterThan(100);
  });

  it("preserves explicit symbols when provided", () => {
    expect(resolveKittenSymbols(["$", "a"])).toEqual(["$", "a"]);
  });
});
