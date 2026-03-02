export function parseDialogueScript(script, voiceA, voiceB) {
  const lines = String(script || "").split("\n");
  const speakerOrder = new Map();
  const turns = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (/^\d+\.$/.test(line)) continue;

    let speaker = "";
    let text = "";

    const bracketMatch = line.match(/^\[(.*?)\]\s*(.+)$/);
    if (bracketMatch) {
      const attrs = bracketMatch[1].split("|").map((x) => x.trim());
      text = bracketMatch[2].trim();
      for (const attr of attrs) {
        const kv = attr.match(/^([A-Z_]+)\s*=\s*(.+)$/i);
        if (!kv) continue;
        if (kv[1].toUpperCase() === "SPEAKER") speaker = kv[2].trim();
      }
    }

    if (!speaker) {
      const legacyMatch = line.match(/^([A-Z][A-Z0-9_-]{0,40})\s*:\s*(.+)$/i);
      if (!legacyMatch) continue;
      speaker = legacyMatch[1].trim();
      text = legacyMatch[2].trim();
    }

    if (!text) continue;

    if (!speakerOrder.has(speaker)) speakerOrder.set(speaker, speakerOrder.size);
    const idx = speakerOrder.get(speaker);
    const mappedVoice = idx % 2 === 0 ? voiceA : voiceB;
    turns.push({ speaker, text, voice: mappedVoice });
  }

  return turns;
}
