/**
 * WebSocket handler for real-time game communication.
 *
 * For Vercel deployment, use Ably/Pusher/PartyKit instead.
 * This Socket.io implementation works for local dev and self-hosted.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken, JWTPayload } from '../lib/auth';
import { sessionManager } from './session-manager';
import { db } from '../lib/db';

interface AuthenticatedSocket extends Socket {
  data: {
    user: JWTPayload;
    sessionId: string;
  };
}

export function setupWebSocket(io: SocketIOServer) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const sessionId = socket.handshake.query?.session_id as string;

    if (!token || !sessionId) {
      return next(new Error('Authentication required'));
    }

    const user = verifyToken(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }

    (socket as AuthenticatedSocket).data = { user, sessionId };
    next();
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { user, sessionId } = socket.data;

    // Join session room
    socket.join(sessionId);

    // Register event callback for this session
    sessionManager.registerEventCallback(sessionId, (sid, event, data) => {
      io.to(sid).emit(event, data);
    });

    // Handle join
    const { session, error } = await sessionManager.joinSession(sessionId, user.user_id, user.username);
    if (error) {
      socket.emit('game:error', { message: error, code: 'JOIN_FAILED' });
      socket.disconnect();
      return;
    }

    io.to(sessionId).emit('player:joined', { user_id: user.user_id, username: user.username });
    const game = await sessionManager.getOrCreateGame(sessionId);
    socket.emit('game:state_update', { game_state: game.getState() });

    // ===========================
    // Player Actions
    // ===========================

    socket.on('player:action', async (data: { action_type: string; target_id?: string; details?: Record<string, unknown> }) => {
      const game = await sessionManager.getOrCreateGame(sessionId);
      const character = await db.getCharacterByUserId(user.user_id, sessionId);
      if (!character) {
        socket.emit('game:error', { message: 'No character found', code: 'CHARACTER_REQUIRED' });
        return;
      }

      const result = await game.processAction({
        player_id: character.id,
        action_type: data.action_type as any,
        target_id: data.target_id,
        details: data.details,
      });

      if (!result.success) {
        socket.emit('game:error', { message: result.error, code: 'INVALID_ACTION' });
      }
    });

    // Player ready toggle
    socket.on('player:ready', async (data: { ready: boolean }) => {
      const session = await db.getSession(sessionId);
      if (!session) return;

      const updated = {
        ...session,
        players: session.players.map(p =>
          p.user_id === user.user_id ? { ...p, is_ready: data.ready } : p
        ),
      };
      await db.updateSession(updated);
      io.to(sessionId).emit('game:state_update', {
        session: {
          players: updated.players,
          status: updated.status,
        },
      });
    });

    // Start game
    socket.on('game:start', async () => {
      const session = await db.getSession(sessionId);
      if (!session || session.created_by !== user.user_id) {
        socket.emit('game:error', { message: 'Only the host can start the game', code: 'UNAUTHORIZED' });
        return;
      }

      const result = await sessionManager.startGame(sessionId);
      if (!result.success) {
        socket.emit('game:error', { message: result.error, code: 'START_FAILED' });
      }
    });

    // Skill check roll
    socket.on('player:roll', async (data: { skill: string; dc?: number }) => {
      const game = await sessionManager.getOrCreateGame(sessionId);
      const character = await db.getCharacterByUserId(user.user_id, sessionId);
      if (!character) return;

      game.processSkillCheck(character.id, data.skill, data.dc || 10);
    });

    // Rest actions
    socket.on('rest:short', async (data: { hit_dice: number }) => {
      const game = await sessionManager.getOrCreateGame(sessionId);
      const character = await db.getCharacterByUserId(user.user_id, sessionId);
      if (!character) return;

      game.processShortRest({ [character.id]: data.hit_dice || 0 });
    });

    socket.on('rest:long', async () => {
      const game = await sessionManager.getOrCreateGame(sessionId);
      game.processLongRest();
    });

    // Chat
    socket.on('player:chat', (data: { message: string }) => {
      io.to(sessionId).emit('player:chat', {
        user_id: user.user_id,
        username: user.username,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      await sessionManager.leaveSession(sessionId, user.user_id);
      io.to(sessionId).emit('player:disconnected', { user_id: user.user_id, username: user.username });
    });
  });
}
