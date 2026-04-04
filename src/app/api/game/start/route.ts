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

    // Generate opening scene (with fallback if AI fails or returns bad data)
    let scene, narration, mood;
    try {
      const aiResult = await generateStartingScene(game.getState());
      scene = aiResult.scene;
      narration = aiResult.narration;
      mood = aiResult.mood;
    } catch (err) {
      console.error('AI scene generation failed, using fallback:', err);
      scene = {
        id: 'scene_' + Date.now(),
        name: 'The Crossroads Inn',
        description: 'A weathered stone inn stands at a crossroads. Warm light spills from the windows and the smell of roasted meat fills the air.',
        type: 'interior' as const,
        npcs: [{
          id: 'npc_innkeeper',
          name: 'Old Barley',
          description: 'A grizzled innkeeper with a knowing smile',
          disposition: 'friendly' as const,
          personality: 'warm, talkative',
          dialogue_history: [] as string[],
        }],
        monsters_present: [] as string[],
        exits: [
          { direction: 'outside', description: 'The road continues into dark woods' },
          { direction: 'upstairs', description: 'Creaky stairs lead to rooms above' },
          { direction: 'cellar', description: 'A trapdoor behind the bar leads down' },
        ],
      };
      narration = 'You find yourselves gathered in the common room of the Crossroads Inn. A fire crackles in the hearth, and Old Barley the innkeeper polishes a mug behind the bar. "Adventurers, eh?" he says. "Strange noises from the cellar, travelers gone missing on the east road. There might be coin in it for brave folk like yourselves."';
      mood = 'atmospheric';
    }

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
