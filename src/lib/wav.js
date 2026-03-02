function clampToInt16(x) {
  const v = Math.max(-1, Math.min(1, x));
  return v < 0 ? v * 0x8000 : v * 0x7fff;
}

export function floatTo16BitPCM(floatArray) {
  const buffer = new ArrayBuffer(floatArray.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < floatArray.length; i += 1) {
    view.setInt16(i * 2, clampToInt16(floatArray[i]), true);
  }
  return buffer;
}

export function encodeWavFromFloat32(floatArray, sampleRate = 24000, channels = 1) {
  const pcm = floatTo16BitPCM(floatArray);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const dataSize = pcm.byteLength;

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([header, pcm], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
