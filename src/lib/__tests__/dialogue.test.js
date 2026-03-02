import { describe, expect, it } from "vitest";
import { parseDialogueScript } from "../dialogue";

describe("parseDialogueScript", () => {
  it("parses bracket format and maps speakers to alternating voices", () => {
    const script = `
      [SPEAKER=EYE] hello
      [SPEAKER=MOUTH] world
      [SPEAKER=EYE] again
    `;
    const out = parseDialogueScript(script, "voiceA", "voiceB");
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ speaker: "EYE", voice: "voiceA", text: "hello" });
    expect(out[1]).toMatchObject({ speaker: "MOUTH", voice: "voiceB", text: "world" });
    expect(out[2]).toMatchObject({ speaker: "EYE", voice: "voiceA", text: "again" });
  });

  it("supports legacy SPEAKER: text format", () => {
    const script = `
      EYE: one
      NOSE: two
    `;
    const out = parseDialogueScript(script, "A", "B");
    expect(out).toHaveLength(2);
    expect(out[0].voice).toBe("A");
    expect(out[1].voice).toBe("B");
  });

  it("ignores comments, blanks, and section markers", () => {
    const script = `
      # comment
      1.

      [SPEAKER=EYE] hi
    `;
    const out = parseDialogueScript(script, "A", "B");
    expect(out).toHaveLength(1);
    expect(out[0].speaker).toBe("EYE");
  });
});
