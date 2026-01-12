/* eslint-env node */
const Redis = require('ioredis');
const NodeCache = require('node-cache');

/* ==================== CONFIG ==================== */
const UPSTASH_URL = process.env.UPSTASH_REDIS_URL;
const LOCAL_URL = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://:${process.env.REDIS_PASS || ''}@${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}` : null);

const REDIS_URL = UPSTASH_URL || LOCAL_URL;

if (!REDIS_URL) {
  console.warn('[CACHE] WARNING: No Redis URL (UPSTASH_REDIS_URL or REDIS_URL). Falling back to in-memory cache only.');
}

let redis = null;
if (REDIS_URL) {
  console.log(`[CACHE] Connecting to Redis: ${UPSTASH_URL ? 'Upstash' : 'Local (cPanel)'}...`);
  redis = new Redis(REDIS_URL, {
    tls: UPSTASH_URL ? { rejectUnauthorized: false } : undefined,
    retryStrategy: (times) => Math.min(times * 100, 2000),
    maxRetriesPerRequest: 3,
    reconnectOnError: (err) => err.message.includes('READONLY'),
    lazyConnect: true,
  });

  redis.on('connect', () => console.log('[CACHE] Redis CONNECTED'));
  redis.on('ready', () => console.log('[CACHE] Redis READY'));
  redis.on('error', (err) => console.error('[CACHE] Redis ERROR:', err.message));
  redis.on('close', () => console.log('[CACHE] Redis DISCONNECTED'));
}

/* ==================== IN-MEMORY CACHE ==================== */
const memoryCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: true,
});

/* ==================== STATS ==================== */
let stats = {
  hits: 0,
  misses: 0,
  redisHits: 0,
  redisMisses: 0,
  memoryHits: 0,
  memoryMisses: 0,
  sets: 0,
  dels: 0,
  invalidations: 0,
};

/* ==================== KEY BUILDER ==================== */
const KEY = {
  contacts: (id) => `contacts:${id}`,
  chats: (id) => `chats:${id}`,
  messages: (chatId, userId, limit = 50, before = 'head') =>
    `messages:${chatId}:${userId}:${limit}:${before}`,
  unread: (chatId, userId) => `unread:${chatId}:${userId}`,
  status: (id) => `status:${id}`,
  visibleUsers: (id) => `visible_users:${id}`,
  onlineUsers: () => 'online_users',
  statusAll: (id) => `statuses:all:${id}`,
  statusUnseen: (id) => `statuses:unseen_count:${id}`,
  statusViewers: (statusId, order = 'desc', limit = 'all', offset = 0) =>
    `status_viewers:${statusId}:${order}:${limit}:${offset}`,
};

/* ==================== CACHE CORE ==================== */
class Cache {
  constructor() {
    this.redis = redis;
    this.memory = memoryCache;
    this.stats = stats;
    this.connected = false;

    if (redis) {
      redis.status === 'ready' ? (this.connected = true) : null;
      redis.on('ready', () => (this.connected = true));
    }
  }

  /* ---------- GET ---------- */
  async get(key) {
    // 1. Memory
    const mem = this.memory.get(key);
    if (mem !== undefined) {
      stats.hits++;
      stats.memoryHits++;
      return mem;
    }

    // 2. Redis
    if (this.connected && this.redis) {
      try {
        const val = await this.redis.get(key);
        if (val !== null) {
          const parsed = JSON.parse(val);
          this.memory.set(key, parsed, 30);
          stats.hits++;
          stats.redisHits++;
          return parsed;
        }
      } catch (err) {
        console.warn('[CACHE] Redis GET failed:', err.message);
      }
    }

    // 3. Miss
    stats.misses++;
    if (this.redis) stats.redisMisses++;
    else stats.memoryMisses++;
    return null;
  }

  /* ---------- SET ---------- */
  async set(key, value, ttl = 60) {
    const str = JSON.stringify(value);
    stats.sets++;

    // Memory
    this.memory.set(key, value, Math.min(ttl, 60));

    // Redis
    if (this.connected && this.redis) {
      try {
        await this.redis.setex(key, ttl, str);
      } catch (err) {
        console.warn('[CACHE] Redis SET failed:', err.message);
      }
    }
  }

  /* ---------- DELETE ---------- */
  async del(key) {
    stats.dels++;
    this.memory.del(key);
    if (this.connected && this.redis) {
      try { await this.redis.del(key); } catch {}
    }
  }

  /* ---------- INVALIDATE PATTERN ---------- */
  async invalidate(pattern) {
    stats.invalidations++;
    let keys = [];

    // Memory
    const memKeys = this.memory.keys().filter(k => k.includes(pattern));
    memKeys.forEach(k => this.memory.del(k));
    keys.push(...memKeys);

    // Redis
    if (this.connected && this.redis) {
      try {
        const redisKeys = await this.redis.keys(pattern);
        if (redisKeys.length > 0) {
          await this.redis.del(...redisKeys);
          keys.push(...redisKeys);
        }
      } catch (err) {
        console.warn('[CACHE] Invalidation failed:', err.message);
      }
    }

    return keys;
  }

  /* ---------- SPECIFIC METHODS ---------- */
  async getContacts(id) { return this.get(KEY.contacts(id)); }
  async setContacts(id, data) { return this.set(KEY.contacts(id), data, 300); }

  async getChats(id) { return this.get(KEY.chats(id)); }
  async setChats(id, data) { return this.set(KEY.chats(id), data, 30); }

  async getMessages(chatId, userId, limit = 50, before = 'head') {
    return this.get(KEY.messages(chatId, userId, limit, before));
  }
  async setMessages(chatId, userId, data, limit = 50, before = 'head') {
    return this.set(KEY.messages(chatId, userId, limit, before), data, 300);
  }

  async getUnreadCount(chatId, userId) { return this.get(KEY.unread(chatId, userId)); }
  async setUnreadCount(chatId, userId, count) { return this.set(KEY.unread(chatId, userId), count, 300); }

  async getUserStatus(id) { return this.get(KEY.status(id)); }
  async setUserStatus(id, status) { return this.set(KEY.status(id), status, 30); }

  async getVisibleUsers(id) { return this.get(KEY.visibleUsers(id)); }
  async setVisibleUsers(id, users) { return this.set(KEY.visibleUsers(id), users, 300); }

  async getOnlineUsers() { return this.get(KEY.onlineUsers()); }
  async setOnlineUsers(users) { return this.set(KEY.onlineUsers(), users, 30); }

  async getStatusAll(id) { return this.get(KEY.statusAll(id)); }
  async setStatusAll(id, data) { return this.set(KEY.statusAll(id), data, 30); }

  async getStatusUnseen(id) { return this.get(KEY.statusUnseen(id)); }
  async setStatusUnseen(id, count) { return this.set(KEY.statusUnseen(id), count, 60); }

  async getStatusViewers(statusId, order = 'desc', limit = 'all', offset = 0) {
    return this.get(KEY.statusViewers(statusId, order, limit, offset));
  }
  async setStatusViewers(statusId, viewers, order = 'desc', limit = 'all', offset = 0) {
    return this.set(KEY.statusViewers(statusId, order, limit, offset), viewers, 120);
  }

  /* ---------- INVALIDATION HELPERS ---------- */
  async invalidateChat(chatId) {
    return this.invalidate(`*${chatId}*`);
  }

  async invalidateUser(userId) {
    return this.invalidate(`*:${userId}`);
  }

  async invalidateAllChats(userId) {
    return Promise.all([
      this.del(KEY.chats(userId)),
      this.del(KEY.contacts(userId)),
      this.invalidate(`messages:*${userId}*`),
      this.invalidate(`unread:*${userId}*`),
      this.invalidate(`status:*${userId}*`),
    ]);
  }

  async invalidateAllStatuses() {
    return this.invalidate('statuses:*');
  }

  /* ---------- STATS & HEALTH ---------- */
  getStats() {
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : 'N/A';
    return {
      ...stats,
      hitRate,
      redisConnected: this.connected,
      redisSource: UPSTASH_URL ? 'Upstash' : LOCAL_URL ? 'Local (cPanel)' : 'None',
      memoryKeys: this.memory.keys().length,
    };
  }

  resetStats() {
    stats = { hits: 0, misses: 0, redisHits: 0, redisMisses: 0, memoryHits: 0, memoryMisses: 0, sets: 0, dels: 0, invalidations: 0 };
  }

  async quit() {
    if (this.redis && this.connected) {
      await this.redis.quit();
      this.connected = false;
    }
  }
}

/* ==================== EXPORT ==================== */
const cache = new Cache();
module.exports = { cache, KEY };