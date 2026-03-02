import { describe, expect, it } from "vitest";
import { splitTextIntoChunks, tokenizeText } from "../textPipeline";

describe("textPipeline", () => {
  it("splits long text and ensures punctuation", () => {
    const chunks = splitTextIntoChunks("Hello world this is a long sentence without final punctuation", 12);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(/[.!?,;:]$/.test(c)).toBe(true);
    }
  });

  it("tokenizes with prefix/suffix in symbol_map mode", () => {
    const ids = tokenizeText("ab", {
      preprocessMode: "symbol_map",
      symbols: ["$", "a", "b"],
      prefixTokens: [9],
      suffixTokens: [8, 7]
    });
    expect(ids).toEqual([9, 1, 2, 8, 7]);
  });
});
