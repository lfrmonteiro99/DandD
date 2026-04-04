import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateStartingScene } from '@/ai/dm';

// POST /api/game/start — Start the game and generate opening scene
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id } = await req.json();

    const session = await db.getSession(session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.created_by !== auth.user_id) {
      return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 });
    }

    // Start via session manager (validates characters exist)
    const result = await sessionManager.startGame(session_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const game = await sessionManager.getOrCreateGame(session_id);

    // Generate opening scene with AI
    const { scene, narration, mood } = await generateStartingScene(game.getState());
    game.startGame(scene, narration);

    // Add NPCs to game state
    const state = game.getState();
    const npcs: Record<string, any> = {};
    for (const npc of scene.npcs) {
      npcs[npc.id] = npc;
    }
    game.setState({ ...state, npcs });

    return NextResponse.json({
      state: game.getState(),
      narration,
      mood,
    });
  } catch (error) {
    console.error('Game start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
