import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GameSession } from '@/engine/types';

// POST /api/sessions — Create a new session
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, max_players = 4 } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
    }

    if (max_players < 1 || max_players > 6) {
      return NextResponse.json({ error: 'Max players must be between 1 and 6' }, { status: 400 });
    }

    const session: GameSession = {
      id: uuid(),
      name,
      created_by: auth.user_id,
      status: 'lobby',
      max_players,
      players: [{
        user_id: auth.user_id,
        username: auth.username,
        character_id: null,
        is_connected: true,
        is_ready: false,
        joined_at: Date.now(),
      }],
      game_state: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    db.createSession(session);

    return NextResponse.json({ session }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/sessions — List joinable sessions
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const sessions = db.listSessions().filter(s =>
    s.status === 'lobby' || s.players.some(p => p.user_id === auth.user_id)
  );

  return NextResponse.json({
    sessions: sessions.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      player_count: s.players.length,
      max_players: s.max_players,
      created_by: s.created_by,
      created_at: s.created_at,
    })),
  });
}
