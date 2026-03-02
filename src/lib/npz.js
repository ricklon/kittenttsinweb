import JSZip from "jszip";
import npyjs from "npyjs";

export async function loadNpzFromArrayBuffer(zipData) {
  const zip = await JSZip.loadAsync(zipData);
  const parser = new npyjs();
  const entries = {};

  const names = Object.keys(zip.files).filter((name) => name.endsWith(".npy"));
  for (const name of names) {
    const arrBuf = await zip.files[name].async("arraybuffer");
    const parsed = await parser.parse(arrBuf);
    const key = name.replace(/\.npy$/, "");
    entries[key] = parsed;
  }

  return entries;
}

export async function loadNpz(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch NPZ: ${url} (${res.status})`);
  }
  const zipData = await res.arrayBuffer();
  return loadNpzFromArrayBuffer(zipData);
}
