// Persistent player storage backed by IndexedDB (with a localStorage fallback).
// The game reads the profile synchronously from memory; every save is written through to IndexedDB.
const DB_NAME = 'blade_rivals_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const PROFILE_KEY = 'profile';
const LEGACY_LS_KEY = 'blade_rivals_profile_v2'; // the old localStorage save (migrated once)

let db = null;
let memoryJson = null;
let pendingJson = null;
let flushing = false;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Call once before the game starts. Opens IndexedDB and loads the saved profile. */
export async function initStorage() {
  try {
    db = await openDB();
    let json = await idbGet(PROFILE_KEY);
    if (json == null) {
      // One-time migration from the old localStorage save
      const legacy = localStorage.getItem(LEGACY_LS_KEY);
      if (legacy) {
        json = legacy;
        await idbPut(PROFILE_KEY, legacy);
      }
    }
    memoryJson = json;
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to localStorage:', err);
    db = null;
    memoryJson = localStorage.getItem(LEGACY_LS_KEY);
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

export function readSavedProfileJson() {
  return memoryJson;
}

export function writeSavedProfileJson(json) {
  memoryJson = json;
  if (!db) {
    try {
      localStorage.setItem(LEGACY_LS_KEY, json);
    } catch (err) {
      console.warn('Profile save failed:', err);
    }
    return;
  }
  // Coalesce rapid saves: only the newest JSON is written
  pendingJson = json;
  if (!flushing) flushPending();
}

async function flushPending() {
  flushing = true;
  while (pendingJson !== null) {
    const json = pendingJson;
    pendingJson = null;
    try {
      await idbPut(PROFILE_KEY, json);
    } catch (err) {
      console.warn('Profile save failed:', err);
    }
  }
  flushing = false;
}
