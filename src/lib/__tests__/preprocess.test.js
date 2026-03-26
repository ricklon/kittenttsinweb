import { describe, expect, it } from "vitest";
import { preprocessText } from "../preprocess";

describe("preprocessText", () => {
  it("expands currency, percentages, and model names", () => {
    expect(preprocessText("GPT-3 costs $4.99 and is 50% faster.")).toBe(
      "gpt three costs four dollars and ninety-nine cents and is fifty percent faster."
    );
  });

  it("expands times, units, and floats with trailing zeros", () => {
    expect(preprocessText("Meet at 3:05pm and download the 2.50GB file in 12ms.")).toBe(
      "meet at three oh five pm and download the two point five zero gigabytes file in twelve milliseconds."
    );
  });

  it("expands phone numbers and ip addresses before generic number replacement", () => {
    expect(preprocessText("Call 555-1234 or connect to 192.168.1.1.")).toBe(
      "call five five five one two three four or connect to one nine two dot one six eight dot one dot one."
    );
  });
});
