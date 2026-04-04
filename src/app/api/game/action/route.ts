import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateNarration, decideMonsterAction } from '@/ai/dm';
import { getCurrentTurnEntity } from '@/engine/combat';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id, action_type, target_id, text } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const character = await db.getCharacterByUserId(auth.user_id, session_id);
    if (!character) {
      return NextResponse.json({ error: 'No character in session' }, { status: 400 });
    }

    // getOrCreateGame handles full state restoration from Redis
    const game = await sessionManager.getOrCreateGame(session_id);
    const state = game.getState();

    // Ensure this character is in the game state
    if (!state.characters[character.id]) {
      game.addCharacter(character);
    }

    if (state.phase === 'lobby' || state.phase === 'character_creation') {
      return NextResponse.json({ error: 'Game has not started yet' }, { status: 400 });
    }

    // === COMBAT ===
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

      // Process monster turns if needed
      const updatedState = game.getState();
      if (updatedState.combat) {
        const current = getCurrentTurnEntity(updatedState.combat);
        if (current.entity_type === 'monster') {
          await processMonsterTurns(game);
        }
      }

      await game.saveState();
      return NextResponse.json({ state: game.getState() });
    }

    // === EXPLORATION / SOCIAL ===
    const actionText = text || action_type;
    if (!actionText) {
      return NextResponse.json({ error: 'No action text provided' }, { status: 400 });
    }

    // Log the player action
    await game.processAction({
      player_id: character.id,
      action_type: 'free_text',
      details: { text: actionText },
    });

    // Get AI DM response using FRESH state (includes player action in log)
    const freshState = game.getState();
    const dmResponse = await generateNarration(freshState, actionText, character.name);

    // narration is guaranteed non-empty by generateNarration
    const narration = dmResponse.narration;

    // Apply DM decisions
    if (dmResponse.dm_decisions?.encounter_trigger) {
      const enc = dmResponse.dm_decisions.encounter_trigger;
      game.addNarration(narration, dmResponse.mood);
      game.startCombat(enc.monsters, enc.description || narration);

      const combatState = game.getState();
      if (combatState.combat) {
        const current = getCurrentTurnEntity(combatState.combat);
        if (current.entity_type === 'monster') {
          await processMonsterTurns(game);
        }
      }
    } else if (dmResponse.dm_decisions?.check_required) {
      const check = dmResponse.dm_decisions.check_required;
      game.addNarration(narration, dmResponse.mood);
      await game.saveState();
      return NextResponse.json({
        state: game.getState(),
        narration,
        check_required: {
          skill: check.skill,
          dc: check.dc,
          player_id: check.player_id || character.id,
        },
      });
    } else {
      game.addNarration(narration, dmResponse.mood);
      if (dmResponse.dm_decisions?.scene_changes?.description && freshState.scene) {
        game.updateScene({
          ...freshState.scene,
          description: dmResponse.dm_decisions.scene_changes.description,
        });
      }
    }

    // CRITICAL: Await persist
    await game.saveState();

    return NextResponse.json({
      state: game.getState(),
      narration,
      mood: dmResponse.mood || 'neutral',
    });
  } catch (error) {
    console.error('Game action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processMonsterTurns(game: Awaited<ReturnType<typeof sessionManager.getOrCreateGame>>) {
  let state = game.getState();
  let safetyCounter = 0;

  while (state.combat && safetyCounter < 20) {
    const current = getCurrentTurnEntity(state.combat);
    if (current.entity_type !== 'monster') break;

    const monster = state.combat.monsters.find(m => m.id === current.entity_id);
    if (!monster || monster.current_hp <= 0) {
      game.processMonsterTurn({
        monster_id: current.entity_id,
        target_id: Object.keys(state.characters)[0] || '',
      });
      state = game.getState();
      safetyCounter++;
      continue;
    }

    try {
      const decision = await decideMonsterAction(state, current.entity_id);
      game.processMonsterTurn({
        monster_id: decision.monster_id,
        target_id: decision.target_id || Object.keys(state.characters)[0] || '',
        attack_name: decision.attack_name,
      });
    } catch {
      const aliveTargets = Object.values(state.characters).filter(c => c.current_hp > 0);
      const target = aliveTargets[0];
      if (target) {
        game.processMonsterTurn({
          monster_id: current.entity_id,
          target_id: target.id,
          attack_name: monster.attacks[0]?.name,
        });
      }
    }

    state = game.getState();
    safetyCounter++;
  }
}
