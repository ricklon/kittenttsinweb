const DB_NAME = "kittentts-cache-v1";
const STORE_NAME = "assets";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet(db, url) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function txPut(db, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(value);
  });
}

function txDelete(db, url) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).delete(url);
  });
}

export async function fetchArrayBufferCached(url) {
  const db = await openDb();
  const cached = await txGet(db, url);
  if (cached?.buffer) return cached.buffer;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${url} (${res.status})`);
  const buffer = await res.arrayBuffer();
  await txPut(db, { url, buffer, updatedAt: Date.now() });
  return buffer;
}

export async function fetchArrayBufferFresh(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch asset: ${url} (${res.status})`);
  const buffer = await res.arrayBuffer();
  const db = await openDb();
  await txPut(db, { url, buffer, updatedAt: Date.now() });
  return buffer;
}

export async function fetchJsonCached(url) {
  const db = await openDb();
  const cached = await txGet(db, url);
  if (cached?.json) return cached.json;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JSON: ${url} (${res.status})`);
  const json = await res.json();
  await txPut(db, { url, json, updatedAt: Date.now() });
  return json;
}

export async function fetchJsonFresh(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch JSON: ${url} (${res.status})`);
  const json = await res.json();
  const db = await openDb();
  await txPut(db, { url, json, updatedAt: Date.now() });
  return json;
}

export async function invalidateCached(url) {
  const db = await openDb();
  await txDelete(db, url);
}
