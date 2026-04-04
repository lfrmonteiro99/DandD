import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateStartingScene } from '@/ai/dm';
import { createCharacter } from '@/engine/character';
import { CharacterCreateInput, CharacterClass, Race } from '@/engine/types';

const AI_COMPANIONS: { name: string; race: Race; class: CharacterClass; abilities: Record<string, number> }[] = [
  { name: 'Thorin Ironfist', race: 'dwarf', class: 'fighter', abilities: { strength: 15, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma: 13 } },
  { name: 'Elara Moonwhisper', race: 'elf', class: 'wizard', abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 15, wisdom: 13, charisma: 10 } },
  { name: 'Pip Lightfoot', race: 'halfling', class: 'rogue', abilities: { strength: 8, dexterity: 15, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14 } },
  { name: 'Brother Marcus', race: 'human', class: 'cleric', abilities: { strength: 13, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 15, charisma: 12 } },
];

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

    // Start game via session manager (loads player characters)
    const result = await sessionManager.startGame(session_id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const game = await sessionManager.getOrCreateGame(session_id);

    // Fill empty slots with AI companions
    const existingClasses = new Set(
      Object.values(game.getState().characters).map(c => c.class)
    );
    const humanCount = Object.keys(game.getState().characters).length;
    const companionsNeeded = Math.max(0, 4 - humanCount);

    let companionsAdded = 0;
    for (const template of AI_COMPANIONS) {
      if (companionsAdded >= companionsNeeded) break;
      if (existingClasses.has(template.class) && companionsAdded < companionsNeeded - 1) continue;

      const companion = createCharacter({
        name: template.name,
        race: template.race,
        class: template.class,
        ability_assignments: template.abilities as any,
        session_id,
        user_id: 'ai_companion',
      });

      game.addCharacter(companion);
      await db.createCharacter(companion);
      existingClasses.add(template.class);
      companionsAdded++;
    }

    // Fill remaining if needed
    for (const template of AI_COMPANIONS) {
      if (companionsAdded >= companionsNeeded) break;
      if (!existingClasses.has(template.class)) continue; // already added above

      const companion = createCharacter({
        name: template.name + ' II',
        race: template.race,
        class: template.class,
        ability_assignments: template.abilities as any,
        session_id,
        user_id: 'ai_companion',
      });

      game.addCharacter(companion);
      await db.createCharacter(companion);
      companionsAdded++;
    }

    // Generate opening scene
    const { scene, narration, mood } = await generateStartingScene(game.getState());

    // Set scene, NPCs, and start game — all in one state update
    const state = game.getState();
    const npcs: Record<string, any> = {};
    for (const npc of scene.npcs) {
      npcs[npc.id] = npc;
    }
    game.setState({
      ...state,
      phase: 'exploration',
      scene,
      npcs,
    });

    // Log the narration
    game.addNarration(narration, mood);

    // CRITICAL: Await persist to Redis
    await game.saveState();

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
