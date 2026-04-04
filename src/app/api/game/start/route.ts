import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateStartingScene } from '@/ai/dm';
import { createCharacter } from '@/engine/character';
import { CharacterCreateInput, CharacterClass, Race } from '@/engine/types';

// AI companion templates
const AI_COMPANIONS: { name: string; race: Race; class: CharacterClass; abilities: Record<string, number> }[] = [
  { name: 'Thorin Ironfist', race: 'dwarf', class: 'fighter', abilities: { strength: 15, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma: 13 } },
  { name: 'Elara Moonwhisper', race: 'elf', class: 'wizard', abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 15, wisdom: 13, charisma: 10 } },
  { name: 'Pip Lightfoot', race: 'halfling', class: 'rogue', abilities: { strength: 8, dexterity: 15, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14 } },
  { name: 'Brother Marcus', race: 'human', class: 'cleric', abilities: { strength: 13, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 15, charisma: 12 } },
];

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

    // Start via session manager
    const result = await sessionManager.startGame(session_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const game = await sessionManager.getOrCreateGame(session_id);

    // Add real player characters
    for (const player of session.players) {
      if (player.character_id) {
        const character = await db.getCharacter(player.character_id);
        if (character) {
          game.addCharacter(character);
        }
      }
    }

    // Fill remaining slots with AI companions
    const humanCount = session.players.filter(p => p.character_id).length;
    const companionsNeeded = Math.max(0, 4 - humanCount); // Fill up to 4 total
    const existingClasses = new Set<string>();

    // Track which classes human players picked
    for (const player of session.players) {
      if (player.character_id) {
        const char = await db.getCharacter(player.character_id);
        if (char) existingClasses.add(char.class);
      }
    }

    // Add companions with different classes than the human players
    let companionsAdded = 0;
    for (const template of AI_COMPANIONS) {
      if (companionsAdded >= companionsNeeded) break;
      // Prefer classes the party doesn't have yet
      if (existingClasses.has(template.class) && companionsAdded < companionsNeeded - 1) {
        continue; // Skip duplicate classes unless we need to fill
      }

      const companion = createCharacter({
        name: template.name,
        race: template.race,
        class: template.class,
        ability_assignments: template.abilities as any,
        session_id: session_id,
        user_id: 'ai_companion',
      });

      game.addCharacter(companion);
      existingClasses.add(template.class);
      companionsAdded++;
    }

    // If we still need more, add the skipped ones
    if (companionsAdded < companionsNeeded) {
      for (const template of AI_COMPANIONS) {
        if (companionsAdded >= companionsNeeded) break;
        if (existingClasses.has(template.class)) {
          const companion = createCharacter({
            name: template.name + ' II',
            race: template.race,
            class: template.class,
            ability_assignments: template.abilities as any,
            session_id: session_id,
            user_id: 'ai_companion',
          });
          game.addCharacter(companion);
          companionsAdded++;
        }
      }
    }

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
      companions_added: companionsAdded,
    });
  } catch (error) {
    console.error('Game start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
