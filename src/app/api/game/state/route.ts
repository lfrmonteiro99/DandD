import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  const session = await db.getSession(sessionId);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const isInSession = session.players.some(p => p.user_id === auth.user_id);
  if (!isInSession) return NextResponse.json({ error: 'Not in this session' }, { status: 403 });

  // getOrCreateGame handles full state restoration from Redis on cold start
  const game = await sessionManager.getOrCreateGame(sessionId);
  const state = game.getState();

  // Also get persistent log from DB (survives cold starts better than in-memory recent_log)
  const persistentLog = await db.getGameLogs(sessionId, 50);

  return NextResponse.json({
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      players: session.players,
      max_players: session.max_players,
      created_by: session.created_by,
    },
    game_state: state,
    log: persistentLog,
  });
}
