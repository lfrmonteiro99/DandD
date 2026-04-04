import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createCharacter, validateAbilityScores } from '@/engine/character';
import { CharacterCreateInput, Race, CharacterClass } from '@/engine/types';

const VALID_RACES: Race[] = ['human', 'elf', 'dwarf', 'halfling'];
const VALID_CLASSES: CharacterClass[] = ['fighter', 'wizard', 'rogue', 'cleric'];

// POST /api/characters — Create a character
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id, name, race, character_class, abilities } = await req.json();

    if (!session_id || !name || !race || !character_class || !abilities) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_RACES.includes(race)) {
      return NextResponse.json({ error: `Invalid race. Must be one of: ${VALID_RACES.join(', ')}` }, { status: 400 });
    }

    if (!VALID_CLASSES.includes(character_class)) {
      return NextResponse.json({ error: `Invalid class. Must be one of: ${VALID_CLASSES.join(', ')}` }, { status: 400 });
    }

    if (!validateAbilityScores(abilities)) {
      return NextResponse.json({ error: 'Ability scores must use the Standard Array: 15, 14, 13, 12, 10, 8' }, { status: 400 });
    }

    const session = db.getSession(session_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isInSession = session.players.some(p => p.user_id === auth.user_id);
    if (!isInSession) {
      return NextResponse.json({ error: 'You are not in this session' }, { status: 403 });
    }

    // Check if player already has a character in this session
    const existing = db.getCharacterByUserId(auth.user_id, session_id);
    if (existing) {
      return NextResponse.json({ error: 'You already have a character in this session' }, { status: 409 });
    }

    const input: CharacterCreateInput = {
      name,
      race,
      class: character_class,
      ability_assignments: abilities,
      session_id,
      user_id: auth.user_id,
    };

    const character = createCharacter(input);
    db.createCharacter(character);

    // Update session player with character ID
    const updatedSession = {
      ...session,
      players: session.players.map(p =>
        p.user_id === auth.user_id ? { ...p, character_id: character.id } : p
      ),
      updated_at: Date.now(),
    };
    db.updateSession(updatedSession);

    return NextResponse.json({ character }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
