import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateNarration, decideMonsterAction, generateStartingScene } from '@/ai/dm';
import { getCurrentTurnEntity } from '@/engine/combat';

// POST /api/game/action — Process a player action (with AI DM)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id, action_type, target_id, text } = await req.json();

    const session = db.getSession(session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const character = db.getCharacterByUserId(auth.user_id, session_id);
    if (!character) return NextResponse.json({ error: 'No character in session' }, { status: 400 });

    const game = sessionManager.getOrCreateGame(session_id);
    const state = game.getState();

    // Handle combat actions
    if (state.phase === 'combat') {
      const result = await game.processAction({
        player_id: character.id,
        action_type,
        target_id,
        details: { text, spell_id: target_id },
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // If it's now a monster's turn, process it
      const updatedState = game.getState();
      if (updatedState.combat) {
        const current = getCurrentTurnEntity(updatedState.combat);
        if (current.entity_type === 'monster') {
          await processMonsterTurns(game);
        }
      }

      return NextResponse.json({ state: game.getState() });
    }

    // Handle exploration / social actions
    if (action_type === 'free_text' && text) {
      // Process through game engine
      await game.processAction({
        player_id: character.id,
        action_type: 'free_text',
        details: { text },
      });

      // Get AI DM response
      const dmResponse = await generateNarration(state, text, character.name);

      // Apply DM decisions
      if (dmResponse.dm_decisions?.encounter_trigger) {
        const enc = dmResponse.dm_decisions.encounter_trigger;
        game.addNarration(dmResponse.narration, dmResponse.mood);
        game.startCombat(enc.monsters, enc.description || dmResponse.narration);

        // Process any monster turns at the start
        const combatState = game.getState();
        if (combatState.combat) {
          const current = getCurrentTurnEntity(combatState.combat);
          if (current.entity_type === 'monster') {
            await processMonsterTurns(game);
          }
        }
      } else if (dmResponse.dm_decisions?.check_required) {
        const check = dmResponse.dm_decisions.check_required;
        game.addNarration(dmResponse.narration, dmResponse.mood);
        // Request a skill check from the player
        return NextResponse.json({
          state: game.getState(),
          narration: dmResponse.narration,
          check_required: {
            skill: check.skill,
            dc: check.dc,
            player_id: check.player_id || character.id,
          },
        });
      } else {
        game.addNarration(dmResponse.narration, dmResponse.mood);
        if (dmResponse.dm_decisions?.scene_changes?.description) {
          const currentScene = state.scene;
          if (currentScene) {
            game.updateScene({
              ...currentScene,
              description: dmResponse.dm_decisions.scene_changes.description,
            });
          }
        }
      }

      return NextResponse.json({
        state: game.getState(),
        narration: dmResponse.narration,
        mood: dmResponse.mood,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Game action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processMonsterTurns(game: ReturnType<typeof sessionManager.getOrCreateGame>) {
  let state = game.getState();
  let safetyCounter = 0;

  while (state.combat && safetyCounter < 20) {
    const current = getCurrentTurnEntity(state.combat);
    if (current.entity_type !== 'monster') break;

    const monster = state.combat.monsters.find(m => m.id === current.entity_id);
    if (!monster || monster.current_hp <= 0) {
      // Skip dead monsters
      game.processMonsterTurn({
        monster_id: current.entity_id,
        target_id: Object.keys(state.characters)[0],
      });
      state = game.getState();
      safetyCounter++;
      continue;
    }

    const decision = await decideMonsterAction(state, current.entity_id);
    game.processMonsterTurn({
      monster_id: decision.monster_id,
      target_id: decision.target_id || Object.keys(state.characters)[0] || '',
      attack_name: decision.attack_name,
    });

    state = game.getState();
    safetyCounter++;
  }
}
