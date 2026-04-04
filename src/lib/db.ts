/**
 * Persistent key-value database using Vercel KV (Redis).
 * Falls back to in-memory for local development.
 *
 * Vercel KV setup:
 *   1. Go to Vercel Dashboard → Storage → Create → KV
 *   2. Connect it to your project (auto-sets env vars)
 *   3. That's it — KV_REST_API_URL and KV_REST_API_TOKEN are set automatically
 */

import { GameSession, Character, GameState, GameLogEntry } from '../engine/types';

interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: number;
}

// ===========================
// Vercel KV Client
// ===========================

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const USE_KV = !!(KV_URL && KV_TOKEN);

async function kvGet<T>(key: string): Promise<T | null> {
  if (!USE_KV) return memoryStore.get(key) as T | null;
  try {
    const res = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await res.json();
    if (data.result === null) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch {
    return memoryStore.get(key) as T | null;
  }
}

async function kvSet(key: string, value: unknown, exSeconds?: number): Promise<void> {
  memoryStore.set(key, value); // Always keep in memory as cache
  if (!USE_KV) return;
  try {
    const body = exSeconds
      ? ['SET', key, JSON.stringify(value), 'EX', exSeconds.toString()]
      : ['SET', key, JSON.stringify(value)];
    await fetch(`${KV_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('KV set error:', err);
  }
}

async function kvDel(key: string): Promise<void> {
  memoryStore.delete(key);
  if (!USE_KV) return;
  try {
    await fetch(`${KV_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['DEL', key]),
    });
  } catch (err) {
    console.error('KV del error:', err);
  }
}

async function kvKeys(pattern: string): Promise<string[]> {
  if (!USE_KV) {
    const prefix = pattern.replace('*', '');
    return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
  }
  try {
    const res = await fetch(`${KV_URL}/keys/${pattern}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await res.json();
    return data.result || [];
  } catch {
    const prefix = pattern.replace('*', '');
    return Array.from(memoryStore.keys()).filter(k => k.startsWith(prefix));
  }
}

// In-memory fallback (for local dev or when KV is not configured)
const memoryStore = new Map<string, unknown>();

// ===========================
// Database API (async)
// ===========================

const EXPIRY = 86400; // 24 hours

export const db = {
  // Users
  async createUser(user: User): Promise<User> {
    await kvSet(`user:${user.id}`, user, EXPIRY);
    await kvSet(`user:email:${user.email}`, user.id, EXPIRY);
    await kvSet(`user:username:${user.username}`, user.id, EXPIRY);
    return user;
  },

  async getUserById(id: string): Promise<User | null> {
    return kvGet<User>(`user:${id}`);
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const id = await kvGet<string>(`user:email:${email}`);
    if (!id) return null;
    return kvGet<User>(`user:${id}`);
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const id = await kvGet<string>(`user:username:${username}`);
    if (!id) return null;
    return kvGet<User>(`user:${id}`);
  },

  // Sessions
  async createSession(session: GameSession): Promise<GameSession> {
    await kvSet(`session:${session.id}`, session, EXPIRY);
    await kvSet(`session:list:${session.id}`, session.id, EXPIRY);
    return session;
  },

  async getSession(id: string): Promise<GameSession | null> {
    return kvGet<GameSession>(`session:${id}`);
  },

  async updateSession(session: GameSession): Promise<GameSession> {
    await kvSet(`session:${session.id}`, session, EXPIRY);
    return session;
  },

  async listSessions(): Promise<GameSession[]> {
    const keys = await kvKeys('session:list:*');
    const sessions: GameSession[] = [];
    for (const key of keys) {
      const id = await kvGet<string>(key);
      if (id) {
        const session = await kvGet<GameSession>(`session:${id}`);
        if (session) sessions.push(session);
      }
    }
    return sessions;
  },

  // Characters
  async createCharacter(character: Character): Promise<Character> {
    await kvSet(`char:${character.id}`, character, EXPIRY);
    await kvSet(`char:user:${character.user_id}:${character.session_id}`, character.id, EXPIRY);
    await kvSet(`char:session:${character.session_id}:${character.id}`, character.id, EXPIRY);
    return character;
  },

  async getCharacter(id: string): Promise<Character | null> {
    return kvGet<Character>(`char:${id}`);
  },

  async updateCharacter(character: Character): Promise<Character> {
    await kvSet(`char:${character.id}`, character, EXPIRY);
    return character;
  },

  async getCharactersBySession(sessionId: string): Promise<Character[]> {
    const keys = await kvKeys(`char:session:${sessionId}:*`);
    const characters: Character[] = [];
    for (const key of keys) {
      const id = await kvGet<string>(key);
      if (id) {
        const char = await kvGet<Character>(`char:${id}`);
        if (char) characters.push(char);
      }
    }
    return characters;
  },

  async getCharacterByUserId(userId: string, sessionId: string): Promise<Character | null> {
    const id = await kvGet<string>(`char:user:${userId}:${sessionId}`);
    if (!id) return null;
    return kvGet<Character>(`char:${id}`);
  },

  // Game States
  async saveGameState(sessionId: string, state: GameState): Promise<void> {
    await kvSet(`gamestate:${sessionId}`, state, EXPIRY);
  },

  async getGameState(sessionId: string): Promise<GameState | null> {
    return kvGet<GameState>(`gamestate:${sessionId}`);
  },

  // Game Logs
  async addLogEntry(sessionId: string, entry: GameLogEntry): Promise<void> {
    const logs = await kvGet<GameLogEntry[]>(`gamelog:${sessionId}`) || [];
    logs.push(entry);
    // Keep last 200 entries
    const trimmed = logs.slice(-200);
    await kvSet(`gamelog:${sessionId}`, trimmed, EXPIRY);
  },

  async getGameLogs(sessionId: string, limit: number = 50): Promise<GameLogEntry[]> {
    const logs = await kvGet<GameLogEntry[]>(`gamelog:${sessionId}`) || [];
    return logs.slice(-limit);
  },
};
