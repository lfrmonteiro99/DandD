import { GameLoop, GameEventCallback } from './game-loop';
import { GameSession, Character, Scene } from '../engine/types';
import { db } from '../lib/db';

class SessionManager {
  private activeGames: Map<string, GameLoop> = new Map();
  private eventCallbacks: Map<string, GameEventCallback> = new Map();

  registerEventCallback(sessionId: string, callback: GameEventCallback) {
    this.eventCallbacks.set(sessionId, callback);
  }

  removeEventCallback(sessionId: string) {
    this.eventCallbacks.delete(sessionId);
  }

  async getOrCreateGame(sessionId: string): Promise<GameLoop> {
    let game = this.activeGames.get(sessionId);
    if (!game) {
      const callback: GameEventCallback = (sid, event, data) => {
        const cb = this.eventCallbacks.get(sid);
        if (cb) cb(sid, event, data);
      };
      game = new GameLoop(sessionId, callback);
      this.activeGames.set(sessionId, game);

      // Restore state if exists
      const savedState = await db.getGameState(sessionId);
      if (savedState) {
        game.setState(savedState);
      }
    }
    return game;
  }

  removeGame(sessionId: string) {
    this.activeGames.delete(sessionId);
    this.eventCallbacks.delete(sessionId);
  }

  async joinSession(sessionId: string, userId: string, username: string): Promise<{ session: GameSession | null; error?: string }> {
    const session = await db.getSession(sessionId);
    if (!session) return { session: null, error: 'Session not found' };

    if (session.status !== 'lobby') {
      const isExisting = session.players.some(p => p.user_id === userId);
      if (!isExisting) return { session: null, error: 'Session already in progress' };

      const updated = {
        ...session,
        players: session.players.map(p =>
          p.user_id === userId ? { ...p, is_connected: true } : p
        ),
      };
      await db.updateSession(updated);
      return { session: updated };
    }

    if (session.players.length >= session.max_players) {
      return { session: null, error: 'Session is full' };
    }

    if (session.players.some(p => p.user_id === userId)) {
      const updated = {
        ...session,
        players: session.players.map(p =>
          p.user_id === userId ? { ...p, is_connected: true } : p
        ),
      };
      await db.updateSession(updated);
      return { session: updated };
    }

    const updated: GameSession = {
      ...session,
      players: [
        ...session.players,
        {
          user_id: userId,
          username,
          character_id: null,
          is_connected: true,
          is_ready: false,
          joined_at: Date.now(),
        },
      ],
      updated_at: Date.now(),
    };
    await db.updateSession(updated);
    return { session: updated };
  }

  async leaveSession(sessionId: string, userId: string) {
    const session = await db.getSession(sessionId);
    if (!session) return;

    const updated = {
      ...session,
      players: session.players.map(p =>
        p.user_id === userId ? { ...p, is_connected: false } : p
      ),
      updated_at: Date.now(),
    };
    await db.updateSession(updated);
  }

  async startGame(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = await db.getSession(sessionId);
    if (!session) return { success: false, error: 'Session not found' };
    if (session.status !== 'lobby') return { success: false, error: 'Session already started' };

    const allHaveCharacters = session.players.every(p => p.character_id !== null);
    if (!allHaveCharacters) {
      return { success: false, error: 'All players must create characters before starting' };
    }

    const updated: GameSession = {
      ...session,
      status: 'in_progress',
      updated_at: Date.now(),
    };
    await db.updateSession(updated);

    const game = await this.getOrCreateGame(sessionId);
    for (const player of session.players) {
      if (player.character_id) {
        const character = await db.getCharacter(player.character_id);
        if (character) {
          game.addCharacter(character);
        }
      }
    }

    return { success: true };
  }
}

export const sessionManager = new SessionManager();
