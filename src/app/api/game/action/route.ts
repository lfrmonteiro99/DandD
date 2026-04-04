import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionManager } from '@/server/session-manager';
import { generateNarration, decideMonsterAction } from '@/ai/dm';
import { getCurrentTurnEntity } from '@/engine/combat';

// POST /api/game/action — Process a player action (with AI DM)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { session_id, action_type, target_id, text } = await req.json();

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const session = await db.getSession(session_id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const character = await db.getCharacterByUserId(auth.user_id, session_id);
    if (!character) {
      return NextResponse.json({ error: 'No character in session' }, { status: 400 });
    }

    const game = await sessionManager.getOrCreateGame(session_id);
    let state = game.getState();

    // Ensure characters are loaded into game state (serverless may have fresh instance)
    if (!state.characters[character.id]) {
      game.addCharacter(character);
      // Also reload AI companions
      const allChars = await db.getCharactersBySession(session_id);
      for (const c of allChars) {
        if (!state.characters[c.id]) {
          game.addCharacter(c);
        }
      }
      state = game.getState();
    }

    // If game phase is lobby, it wasn't started properly
    if (state.phase === 'lobby') {
      return NextResponse.json({
        error: 'Game has not started yet',
        state,
      }, { status: 400 });
    }

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

      const updatedState = game.getState();
      if (updatedState.combat) {
        const current = getCurrentTurnEntity(updatedState.combat);
        if (current.entity_type === 'monster') {
          await processMonsterTurns(game);
        }
      }

      return NextResponse.json({ state: game.getState() });
    }

    // Handle exploration / social — free text actions
    const actionText = text || action_type;
    if (!actionText) {
      return NextResponse.json({ error: 'No action text provided' }, { status: 400 });
    }

    // Log the player action
    game.processAction({
      player_id: character.id,
      action_type: 'free_text',
      details: { text: actionText },
    });

    // Get AI DM response
    let narration: string;
    let dmResponse;
    try {
      dmResponse = await generateNarration(state, actionText, character.name);
      narration = dmResponse.narration || `${character.name} ${actionText}. The DM considers what happens next...`;
    } catch (err) {
      console.error('AI narration failed:', err);
      narration = `${character.name} attempts to ${actionText}. The world around you stirs in response...`;
      dmResponse = { narration, dm_decisions: {}, mood: 'neutral' };
    }

    // Ensure narration is never empty
    if (!narration || narration.trim() === '') {
      narration = `You ${actionText}. The dungeon master nods thoughtfully...`;
    }

    // Apply DM decisions
    if (dmResponse?.dm_decisions?.encounter_trigger) {
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
    } else if (dmResponse?.dm_decisions?.check_required) {
      const check = dmResponse.dm_decisions.check_required;
      game.addNarration(narration, dmResponse.mood);
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
      game.addNarration(narration, dmResponse?.mood);
      if (dmResponse?.dm_decisions?.scene_changes?.description && state.scene) {
        game.updateScene({
          ...state.scene,
          description: dmResponse.dm_decisions.scene_changes.description,
        });
      }
    }

    return NextResponse.json({
      state: game.getState(),
      narration,
      mood: dmResponse?.mood || 'neutral',
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
      // AI failed for monster, just do a basic attack
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
