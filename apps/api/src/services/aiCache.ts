import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(__dirname, "..", "..", ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ai-responses.json");
const DEFAULT_TTL_MS = Number(process.env.AI_CACHE_TTL_MS ?? 60 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.AI_CACHE_MAX_ENTRIES ?? 250);
const CACHE_ENABLED = process.env.AI_CACHE_ENABLED !== "false";

type CacheRecord<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

type CacheStore = Record<string, CacheRecord<unknown>>;

const memory = new Map<string, CacheRecord<unknown>>();
let diskLoaded = false;

function isEnabled() {
  return CACHE_ENABLED;
}

function hashKey(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function ensureDiskLoaded() {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as CacheStore;
    for (const [key, entry] of Object.entries(parsed)) {
      memory.set(key, entry);
    }
  } catch (error) {
    console.warn("[ai-cache] Could not load cache file:", error);
  }
}

function persistToDisk() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const payload: CacheStore = {};
    for (const [key, entry] of memory.entries()) {
      payload[key] = entry;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
  } catch (error) {
    console.warn("[ai-cache] Could not persist cache:", error);
  }
}

function prune() {
  const now = Date.now();
  for (const [key, entry] of memory.entries()) {
    if (entry.expiresAt < now) {
      memory.delete(key);
    }
  }
  if (memory.size <= MAX_ENTRIES) return;
  const sorted = [...memory.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  const removeCount = memory.size - MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    memory.delete(sorted[i][0]);
  }
}

export function menuFingerprint(
  menuItems: Array<{ id: string; price: number; available: boolean }>
) {
  return menuItems
    .filter((item) => item.available)
    .map((item) => `${item.id}:${item.price}`)
    .sort()
    .join("|");
}

export function buildParseCacheKey(message: string, menuItems: Parameters<typeof menuFingerprint>[0]) {
  return hashKey(`parse|${menuFingerprint(menuItems)}|${message.trim().toLowerCase()}`);
}

export function buildChatCacheKey(
  messages: Array<{ role: string; content: string }>,
  cart: Array<{ itemId: string; quantity: number }>,
  menuItems: Parameters<typeof menuFingerprint>[0]
) {
  const payload = JSON.stringify({
    menu: menuFingerprint(menuItems),
    cart: cart
      .map((line) => `${line.itemId}:${line.quantity}`)
      .sort()
      .join("|"),
    messages: messages.map((m) => `${m.role}:${m.content.trim().toLowerCase()}`),
  });
  return hashKey(`chat|${payload}`);
}

export function getCached<T>(key: string, options?: { allowStale?: boolean }): T | null {
  if (!isEnabled()) return null;
  ensureDiskLoaded();
  const entry = memory.get(key);
  if (!entry) return null;
  const fresh = entry.expiresAt >= Date.now();
  if (fresh || options?.allowStale) {
    return entry.value as T;
  }
  memory.delete(key);
  return null;
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  if (!isEnabled()) return;
  ensureDiskLoaded();
  const now = Date.now();
  memory.set(key, {
    value,
    createdAt: now,
    expiresAt: now + ttlMs,
  });
  prune();
  persistToDisk();
}

export function cacheStats() {
  ensureDiskLoaded();
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  for (const entry of memory.values()) {
    if (entry.expiresAt >= now) fresh += 1;
    else stale += 1;
  }
  return { enabled: isEnabled(), total: memory.size, fresh, stale };
}
