import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateNarration } from '@/ai/dm';

// POST /api/game/roll — Process a skill check roll
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id, skill, dc } = await req.json();

    if (!session_id || !skill) {
      return NextResponse.json({ error: 'session_id and skill required' }, { status: 400 });
    }

    const character = await db.getCharacterByUserId(auth.user_id, session_id);
    if (!character) return NextResponse.json({ error: 'No character found' }, { status: 400 });

    const game = await sessionManager.getOrCreateGame(session_id);
    const result = game.processSkillCheck(character.id, skill, dc || 10);

    // Get narration for the result
    const state = game.getState();
    const actionDesc = result.success
      ? `succeeded on a ${skill} check (rolled ${result.total} vs DC ${dc})`
      : `failed a ${skill} check (rolled ${result.total} vs DC ${dc})`;

    const dmResponse = await generateNarration(state, actionDesc, character.name);
    game.addNarration(dmResponse.narration, dmResponse.mood);

    return NextResponse.json({
      success: result.success,
      roll: result.roll,
      total: result.total,
      dc,
      narration: dmResponse.narration,
      state: game.getState(),
    });
  } catch (error) {
    console.error('Roll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
