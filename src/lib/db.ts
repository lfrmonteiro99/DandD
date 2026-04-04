/**
 * In-memory database for MVP.
 * Replace with PostgreSQL (Drizzle + Neon) for production.
 */

import { GameSession, Character, GameState, GameLogEntry } from '../engine/types';

interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: number;
}

class InMemoryDB {
  users: Map<string, User> = new Map();
  sessions: Map<string, GameSession> = new Map();
  characters: Map<string, Character> = new Map();
  gameStates: Map<string, GameState> = new Map();
  gameLogs: Map<string, GameLogEntry[]> = new Map();

  // Users
  createUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  getUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  // Sessions
  createSession(session: GameSession): GameSession {
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  updateSession(session: GameSession): GameSession {
    this.sessions.set(session.id, session);
    return session;
  }

  listSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }

  // Characters
  createCharacter(character: Character): Character {
    this.characters.set(character.id, character);
    return character;
  }

  getCharacter(id: string): Character | undefined {
    return this.characters.get(id);
  }

  updateCharacter(character: Character): Character {
    this.characters.set(character.id, character);
    return character;
  }

  getCharactersBySession(sessionId: string): Character[] {
    return Array.from(this.characters.values()).filter(c => c.session_id === sessionId);
  }

  getCharacterByUserId(userId: string, sessionId: string): Character | undefined {
    return Array.from(this.characters.values()).find(
      c => c.user_id === userId && c.session_id === sessionId
    );
  }

  // Game States
  saveGameState(sessionId: string, state: GameState): void {
    this.gameStates.set(sessionId, state);
  }

  getGameState(sessionId: string): GameState | undefined {
    return this.gameStates.get(sessionId);
  }

  // Game Logs
  addLogEntry(sessionId: string, entry: GameLogEntry): void {
    const logs = this.gameLogs.get(sessionId) || [];
    logs.push(entry);
    this.gameLogs.set(sessionId, logs);
  }

  getGameLogs(sessionId: string, limit: number = 50): GameLogEntry[] {
    const logs = this.gameLogs.get(sessionId) || [];
    return logs.slice(-limit);
  }
}

// Singleton
export const db = new InMemoryDB();
