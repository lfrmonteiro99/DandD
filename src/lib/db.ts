/**
 * Persistent database using Upstash Redis.
 * Falls back to in-memory for local development.
 *
 * Setup: Vercel Dashboard → Storage → Upstash → Create Redis DB → Connect to project.
 * Env vars UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set automatically.
 */

import { Redis } from '@upstash/redis';
import { GameSession, Character, GameState, GameLogEntry } from '../engine/types';

interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: number;
}

// ===========================
// Redis Client
// ===========================

// Your exact Vercel env var names
const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;

const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;
const USE_REDIS = !!(UPSTASH_URL && UPSTASH_TOKEN);

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!USE_REDIS) return null;
  if (!_redis) {
    _redis = new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! });
  }
  return _redis;
}

// In-memory fallback (local dev)
const mem = new Map<string, unknown>();

const EXPIRY = 86400; // 24 hours

async function kGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const val = await redis.get<T>(key);
      if (val !== null && val !== undefined) mem.set(key, val); // cache locally
      return val;
    } catch (err) {
      console.error(`Redis GET error for key "${key}":`, err);
      // Fall back to local cache
      return mem.get(key) as T ?? null;
    }
  }
  return mem.get(key) as T ?? null;
}

async function kSet(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: EXPIRY });
    } catch (err) {
      console.error(`Redis SET error for key "${key}":`, err);
      // Retry once
      try {
        await redis.set(key, value, { ex: EXPIRY });
      } catch (retryErr) {
        console.error(`Redis SET retry failed for key "${key}":`, retryErr);
      }
    }
  }
}

async function kDel(key: string): Promise<void> {
  mem.delete(key);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {}
  }
}

async function kKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const keys: string[] = [];
      let cursor = 0;
      do {
        const [nextCursor, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = Number(nextCursor);
        keys.push(...batch);
      } while (cursor !== 0);
      return keys;
    } catch {
      // fallback
    }
  }
  const prefix = pattern.replace('*', '');
  return Array.from(mem.keys()).filter(k => k.startsWith(prefix));
}

// ===========================
// Database API
// ===========================

export const db = {
  // Users
  async createUser(user: User): Promise<User> {
    await kSet(`user:${user.id}`, user);
    await kSet(`user:email:${user.email}`, user.id);
    await kSet(`user:username:${user.username}`, user.id);
    return user;
  },

  async getUserById(id: string): Promise<User | null> {
    return kGet<User>(`user:${id}`);
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const id = await kGet<string>(`user:email:${email}`);
    if (!id) return null;
    return kGet<User>(`user:${id}`);
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const id = await kGet<string>(`user:username:${username}`);
    if (!id) return null;
    return kGet<User>(`user:${id}`);
  },

  // Sessions
  async createSession(session: GameSession): Promise<GameSession> {
    await kSet(`session:${session.id}`, session);
    await kSet(`session:list:${session.id}`, session.id);
    return session;
  },

  async getSession(id: string): Promise<GameSession | null> {
    return kGet<GameSession>(`session:${id}`);
  },

  async updateSession(session: GameSession): Promise<GameSession> {
    await kSet(`session:${session.id}`, session);
    return session;
  },

  async listSessions(): Promise<GameSession[]> {
    const keys = await kKeys('session:list:*');
    const sessions: GameSession[] = [];
    for (const key of keys) {
      const id = await kGet<string>(key);
      if (id) {
        const session = await kGet<GameSession>(`session:${id}`);
        if (session) sessions.push(session);
      }
    }
    return sessions;
  },

  // Characters
  async createCharacter(character: Character): Promise<Character> {
    await kSet(`char:${character.id}`, character);
    await kSet(`char:user:${character.user_id}:${character.session_id}`, character.id);
    await kSet(`char:session:${character.session_id}:${character.id}`, character.id);
    return character;
  },

  async getCharacter(id: string): Promise<Character | null> {
    return kGet<Character>(`char:${id}`);
  },

  async updateCharacter(character: Character): Promise<Character> {
    await kSet(`char:${character.id}`, character);
    return character;
  },

  async getCharactersBySession(sessionId: string): Promise<Character[]> {
    const keys = await kKeys(`char:session:${sessionId}:*`);
    const characters: Character[] = [];
    for (const key of keys) {
      const id = await kGet<string>(key);
      if (id) {
        const char = await kGet<Character>(`char:${id}`);
        if (char) characters.push(char);
      }
    }
    return characters;
  },

  async getCharacterByUserId(userId: string, sessionId: string): Promise<Character | null> {
    const id = await kGet<string>(`char:user:${userId}:${sessionId}`);
    if (!id) return null;
    return kGet<Character>(`char:${id}`);
  },

  // Game States
  async saveGameState(sessionId: string, state: GameState): Promise<void> {
    await kSet(`gamestate:${sessionId}`, state);
  },

  async getGameState(sessionId: string): Promise<GameState | null> {
    return kGet<GameState>(`gamestate:${sessionId}`);
  },

  // Game Logs
  async addLogEntry(sessionId: string, entry: GameLogEntry): Promise<void> {
    const logs = await kGet<GameLogEntry[]>(`gamelog:${sessionId}`) || [];
    logs.push(entry);
    await kSet(`gamelog:${sessionId}`, logs.slice(-200));
  },

  async getGameLogs(sessionId: string, limit: number = 50): Promise<GameLogEntry[]> {
    const logs = await kGet<GameLogEntry[]>(`gamelog:${sessionId}`) || [];
    return logs.slice(-limit);
  },
};
