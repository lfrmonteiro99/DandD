import {
  GameState, GamePhase, PlayerAction, Character, Monster,
  CombatState, GameLogEntry, Scene, NPC,
} from '../engine/types';
import {
  transition, validateAction, createInitialGameState, addLogEntry,
} from '../engine/state-machine';
import {
  createCombatState, resolvePlayerAttack, resolveMonsterAttack,
  advanceTurn, getCurrentTurnEntity, checkCombatEnd,
  applyDamageToMonster, applyDamageToCharacter, processDeathSave,
  applyHealingToCharacter,
} from '../engine/combat';
import { rollAbilityCheck, rollDice, parseDamageString } from '../engine/dice';
import {
  getSkillModifier, getSpellcastingModifier, getSpellSaveDC,
  getSpellAttackModifier, useSpellSlot, shortRest, longRest, calculateModifier,
} from '../engine/character';
import { createMonsterFromTemplate } from '../data/monsters';
import { SPELLS } from '../data/spells';
import { SKILL_ABILITY_MAP } from '../engine/types';
import { db } from '../lib/db';

export type GameEventCallback = (sessionId: string, event: string, data: unknown) => void;

export class GameLoop {
  private state: GameState;
  private sessionId: string;
  private onEvent: GameEventCallback;

  constructor(sessionId: string, onEvent: GameEventCallback) {
    this.sessionId = sessionId;
    this.state = createInitialGameState(sessionId);
    this.onEvent = onEvent;
  }

  getState(): GameState {
    return this.state;
  }

  setState(state: GameState) {
    this.state = state;
    this.persist();
  }

  private persist() {
    db.saveGameState(this.sessionId, this.state);
  }

  private emit(event: string, data: unknown) {
    this.onEvent(this.sessionId, event, data);
  }

  private log(type: GameLogEntry['type'], content: string, actorId?: string, actorName?: string, mechanicalData?: Record<string, unknown>) {
    this.state = addLogEntry(this.state, {
      type,
      content,
      actor_id: actorId || null,
      actor_name: actorName || null,
      mechanical_data: mechanicalData,
    });
  }

  // ===========================
  // Phase Transitions
  // ===========================

  transitionTo(trigger: string) {
    const newPhase = transition(this.state.phase, trigger);
    if (!newPhase) return;

    const oldPhase = this.state.phase;
    this.state = { ...this.state, phase: newPhase };
    this.log('system', `Phase changed from ${oldPhase} to ${newPhase}`);
    this.emit('game:phase_change', { from: oldPhase, to: newPhase });
    this.persist();
  }

  // ===========================
  // Character Management
  // ===========================

  addCharacter(character: Character) {
    this.state = {
      ...this.state,
      characters: { ...this.state.characters, [character.id]: character },
    };
    this.persist();
  }

  // ===========================
  // Start Game
  // ===========================

  startGame(scene: Scene, narration: string) {
    this.state = {
      ...this.state,
      phase: 'exploration',
      scene,
    };
    this.log('narration', narration);
    this.emit('game:narration', { text: narration, mood: 'atmospheric' });
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  // ===========================
  // Process Player Action
  // ===========================

  async processAction(action: PlayerAction): Promise<{ success: boolean; error?: string }> {
    const validation = validateAction(this.state, action);
    if (!validation.valid) {
      this.emit('game:error', { message: validation.error, code: 'INVALID_ACTION' });
      return { success: false, error: validation.error };
    }

    const character = this.state.characters[action.player_id];

    switch (this.state.phase) {
      case 'combat':
        return this.processCombatAction(action, character);
      case 'exploration':
      case 'social':
        return this.processExplorationAction(action, character);
      default:
        return { success: false, error: 'Cannot process actions in current phase' };
    }
  }

  // ===========================
  // Combat Actions
  // ===========================

  startCombat(monsterTemplates: string[], narration: string) {
    const monsters = monsterTemplates.map((t, i) =>
      createMonsterFromTemplate(t, `${t.charAt(0).toUpperCase() + t.slice(1)} ${i + 1}`)
    );

    const characters = Object.values(this.state.characters).filter(c => c.current_hp > 0);
    const combat = createCombatState(characters, monsters);

    this.state = {
      ...this.state,
      phase: 'combat',
      combat,
    };

    this.log('system', 'Combat has begun!');
    this.emit('combat:start', {
      initiative_order: combat.initiative_order,
      monsters: monsters.map(m => ({ id: m.id, name: m.name, ac: m.ac, hp: m.current_hp, max_hp: m.max_hp })),
      narration,
    });

    // Prompt first turn
    this.emitCurrentTurn();
    this.persist();
  }

  private emitCurrentTurn() {
    if (!this.state.combat) return;
    const current = getCurrentTurnEntity(this.state.combat);
    this.emit('combat:turn', {
      entity_id: current.entity_id,
      entity_name: current.entity_name,
      entity_type: current.entity_type,
      round: this.state.combat.round,
    });
  }

  private processCombatAction(action: PlayerAction, character: Character): { success: boolean; error?: string } {
    if (!this.state.combat) return { success: false, error: 'Not in combat' };

    switch (action.action_type) {
      case 'attack':
        return this.processAttack(action, character);
      case 'cast_spell':
        return this.processCastSpell(action, character);
      case 'dodge':
        this.log('combat_action', `${character.name} takes the Dodge action.`, character.id, character.name);
        this.emit('combat:result', {
          action: 'dodge',
          narration: `${character.name} takes a defensive stance, ready to dodge incoming attacks.`,
        });
        this.advanceCombatTurn();
        return { success: true };
      case 'dash':
        this.log('combat_action', `${character.name} takes the Dash action.`, character.id, character.name);
        this.emit('combat:result', {
          action: 'dash',
          narration: `${character.name} dashes forward, doubling their movement speed this turn.`,
        });
        this.advanceCombatTurn();
        return { success: true };
      default:
        this.advanceCombatTurn();
        return { success: true };
    }
  }

  private processAttack(action: PlayerAction, character: Character): { success: boolean; error?: string } {
    if (!this.state.combat || !action.target_id) {
      return { success: false, error: 'Invalid attack' };
    }

    const monsterIndex = this.state.combat.monsters.findIndex(m => m.id === action.target_id);
    if (monsterIndex === -1) return { success: false, error: 'Target not found' };

    const monster = this.state.combat.monsters[monsterIndex];
    const weapon = character.weapons[0]; // Use primary weapon
    if (!weapon) return { success: false, error: 'No weapon equipped' };

    const result = resolvePlayerAttack(character, monster, weapon);
    const rolls = [result.roll, result.damageRoll].filter((r): r is NonNullable<typeof r> => r !== null);

    // Apply damage
    if (result.result.hit && result.result.damage) {
      const updatedMonster = applyDamageToMonster(monster, result.result.damage);
      const updatedMonsters = [...this.state.combat.monsters];
      updatedMonsters[monsterIndex] = updatedMonster;
      this.state = {
        ...this.state,
        combat: { ...this.state.combat, monsters: updatedMonsters },
      };
    }

    const narration = result.result.hit
      ? result.result.target_killed
        ? `${character.name} strikes ${monster.name} with their ${weapon.name} for ${result.result.damage} damage, defeating it!`
        : `${character.name} hits ${monster.name} with their ${weapon.name} for ${result.result.damage} damage!`
      : `${character.name} swings their ${weapon.name} at ${monster.name} but misses!`;

    this.log('combat_action', narration, character.id, character.name, {
      attack_roll: result.roll.total,
      damage: result.result.damage,
      hit: result.result.hit,
      critical: result.roll.is_critical,
    });

    this.emit('combat:result', {
      action: 'attack',
      attacker: character.name,
      target: monster.name,
      rolls,
      result: result.result,
      narration,
    });

    // Check combat end
    const { ended, playersWin } = checkCombatEnd(
      Object.values(this.state.characters),
      this.state.combat!.monsters
    );

    if (ended) {
      this.endCombat(playersWin);
    } else {
      this.advanceCombatTurn();
    }

    return { success: true };
  }

  private processCastSpell(action: PlayerAction, character: Character): { success: boolean; error?: string } {
    const spellId = action.details?.spell_id as string;
    const spell = SPELLS[spellId];
    if (!spell) return { success: false, error: 'Unknown spell' };

    // Use spell slot if not a cantrip
    if (spell.level > 0) {
      const updated = useSpellSlot(character, spell.level);
      if (!updated) return { success: false, error: 'No spell slots available' };
      this.state.characters[character.id] = updated;
    }

    let narration = `${character.name} casts ${spell.name}!`;

    if (spell.damage_die && spell.damage_type && action.target_id && this.state.combat) {
      // Damage spell
      if (spell.attack_roll) {
        const attackMod = getSpellAttackModifier(character);
        const attackRoll = rollAbilityCheck(attackMod, false, 0, false, false, 'spell_attack');
        const monsterIndex = this.state.combat.monsters.findIndex(m => m.id === action.target_id);
        if (monsterIndex >= 0) {
          const monster = this.state.combat.monsters[monsterIndex];
          if (attackRoll.total >= monster.ac || attackRoll.is_critical) {
            const dmgRoll = rollDice(spell.damage_die, spell.damage_dice_count || 1, 0, 'damage');
            const damage = Math.max(1, dmgRoll.total);
            const updatedMonster = applyDamageToMonster(monster, damage);
            const updatedMonsters = [...this.state.combat.monsters];
            updatedMonsters[monsterIndex] = updatedMonster;
            this.state.combat = { ...this.state.combat, monsters: updatedMonsters };
            narration = `${character.name} casts ${spell.name} on ${monster.name} for ${damage} ${spell.damage_type} damage!`;
          } else {
            narration = `${character.name} casts ${spell.name} at ${monster.name}, but the spell goes wide!`;
          }
        }
      } else if (spell.save_type) {
        // Save-based spell
        const dc = getSpellSaveDC(character);
        const monsterIndex = this.state.combat.monsters.findIndex(m => m.id === action.target_id);
        if (monsterIndex >= 0) {
          const monster = this.state.combat.monsters[monsterIndex];
          const saveMod = calculateModifier(monster.abilities[spell.save_type]);
          const saveRoll = rollAbilityCheck(saveMod, false, 0, false, false, 'saving_throw');
          const saved = saveRoll.total >= dc;
          if (!saved) {
            const dmgRoll = rollDice(spell.damage_die, spell.damage_dice_count || 1, 0, 'damage');
            const damage = Math.max(1, dmgRoll.total);
            const updatedMonster = applyDamageToMonster(monster, damage);
            const updatedMonsters = [...this.state.combat.monsters];
            updatedMonsters[monsterIndex] = updatedMonster;
            this.state.combat = { ...this.state.combat, monsters: updatedMonsters };
            narration = `${character.name} casts ${spell.name}! ${monster.name} fails the saving throw and takes ${damage} ${spell.damage_type} damage!`;
          } else {
            narration = `${character.name} casts ${spell.name}! ${monster.name} succeeds on the saving throw!`;
          }
        }
      }
    } else if (spell.healing_die && action.target_id) {
      // Healing spell
      const healTarget = this.state.characters[action.target_id];
      if (healTarget) {
        const healRoll = rollDice(spell.healing_die, spell.healing_dice_count || 1, getSpellcastingModifier(character), 'healing');
        const healing = Math.max(1, healRoll.total);
        this.state.characters[action.target_id] = applyHealingToCharacter(healTarget, healing);
        narration = `${character.name} casts ${spell.name} on ${healTarget.name}, restoring ${healing} hit points!`;
      }
    }

    this.log('combat_action', narration, character.id, character.name);
    this.emit('combat:result', { action: 'cast_spell', spell: spell.name, narration });

    if (this.state.combat) {
      const { ended, playersWin } = checkCombatEnd(
        Object.values(this.state.characters),
        this.state.combat.monsters
      );
      if (ended) {
        this.endCombat(playersWin);
        return { success: true };
      }
    }

    this.advanceCombatTurn();
    return { success: true };
  }

  // ===========================
  // Monster Turns
  // ===========================

  processMonsterTurn(monsterAction: { monster_id: string; target_id: string; attack_name?: string }) {
    if (!this.state.combat) return;

    const monster = this.state.combat.monsters.find(m => m.id === monsterAction.monster_id);
    if (!monster || monster.current_hp <= 0) {
      this.advanceCombatTurn();
      return;
    }

    const target = this.state.characters[monsterAction.target_id];
    if (!target || target.current_hp <= 0) {
      // Find another target
      const aliveTargets = Object.values(this.state.characters).filter(c => c.current_hp > 0);
      if (aliveTargets.length === 0) {
        this.advanceCombatTurn();
        return;
      }
      const newTarget = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      monsterAction.target_id = newTarget.id;
    }

    const finalTarget = this.state.characters[monsterAction.target_id];
    const attack = monster.attacks.find(a => a.name === monsterAction.attack_name) || monster.attacks[0];

    const result = resolveMonsterAttack(monster, attack, finalTarget);

    if (result.result.hit && result.result.damage) {
      this.state.characters[monsterAction.target_id] = applyDamageToCharacter(finalTarget, result.result.damage);
    }

    const narration = result.result.hit
      ? `${monster.name} attacks ${finalTarget.name} with ${attack.name} for ${result.result.damage} damage!`
      : `${monster.name} attacks ${finalTarget.name} with ${attack.name} but misses!`;

    this.log('combat_action', narration, monster.id, monster.name);
    this.emit('combat:result', {
      action: 'attack',
      attacker: monster.name,
      target: finalTarget.name,
      rolls: [result.roll, result.damageRoll].filter(Boolean),
      result: result.result,
      narration,
    });

    const { ended, playersWin } = checkCombatEnd(
      Object.values(this.state.characters),
      this.state.combat.monsters
    );

    if (ended) {
      this.endCombat(playersWin);
    } else {
      this.advanceCombatTurn();
    }
  }

  private advanceCombatTurn() {
    if (!this.state.combat) return;

    this.state = {
      ...this.state,
      combat: advanceTurn(this.state.combat),
    };

    // Skip dead entities
    while (this.state.combat) {
      const current = getCurrentTurnEntity(this.state.combat);
      if (current.entity_type === 'monster') {
        const monster = this.state.combat.monsters.find(m => m.id === current.entity_id);
        if (monster && monster.current_hp <= 0) {
          this.state.combat = advanceTurn(this.state.combat);
          continue;
        }
      } else {
        const char = this.state.characters[current.entity_id];
        if (char && char.current_hp <= 0) {
          // Process death save
          const deathResult = processDeathSave(char);
          this.state.characters[current.entity_id] = {
            ...char,
            death_saves: { successes: deathResult.successes, failures: deathResult.failures },
          };
          if (deathResult.revived) {
            this.state.characters[current.entity_id] = applyHealingToCharacter(char, 1);
            this.emit('combat:result', { narration: `${char.name} rolls a natural 20 on their death save and regains consciousness!` });
          } else if (deathResult.dead) {
            this.emit('combat:result', { narration: `${char.name} has failed their final death save...` });
          } else if (deathResult.stabilized) {
            this.emit('combat:result', { narration: `${char.name} stabilizes! They are unconscious but no longer dying.` });
          } else {
            this.emit('dice:roll', { roller: char.name, roll_data: deathResult.roll, purpose: 'death_save' });
          }
          this.state.combat = advanceTurn(this.state.combat);
          continue;
        }
      }
      break;
    }

    this.emitCurrentTurn();
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  private endCombat(playersWin: boolean) {
    if (!this.state.combat) return;

    const xpTotal = this.state.combat.monsters
      .filter(m => m.current_hp <= 0)
      .reduce((sum, m) => sum + m.xp_value, 0);

    const playerCount = Object.values(this.state.characters).length;
    const xpPerPlayer = Math.floor(xpTotal / playerCount);

    // Award XP
    for (const charId of Object.keys(this.state.characters)) {
      this.state.characters[charId] = {
        ...this.state.characters[charId],
        experience_points: this.state.characters[charId].experience_points + xpPerPlayer,
      };
    }

    this.state = {
      ...this.state,
      phase: 'exploration',
      combat: null,
    };

    const narration = playersWin
      ? `The battle is won! The party earns ${xpTotal} XP (${xpPerPlayer} each).`
      : 'The party has been defeated...';

    this.log('system', narration);
    this.emit('combat:end', {
      outcome: playersWin ? 'victory' : 'defeat',
      xp_earned: xpPerPlayer,
      narration,
    });
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  // ===========================
  // Exploration Actions
  // ===========================

  private processExplorationAction(action: PlayerAction, character: Character): { success: boolean; error?: string } {
    const text = (action.details?.text as string) || action.action_type;

    this.log('player_action', `${character.name}: ${text}`, character.id, character.name);
    this.emit('game:state_update', { game_state: this.state });
    this.persist();

    // The AI DM will handle the response externally
    return { success: true };
  }

  // ===========================
  // Skill Checks
  // ===========================

  processSkillCheck(playerId: string, skill: string, dc: number): { success: boolean; roll: number; total: number } {
    const character = this.state.characters[playerId];
    if (!character) return { success: false, roll: 0, total: 0 };

    const modifier = getSkillModifier(character, skill as keyof typeof SKILL_ABILITY_MAP);
    const proficient = character.skill_proficiencies.includes(skill as keyof typeof SKILL_ABILITY_MAP);
    const roll = rollAbilityCheck(modifier, proficient, character.proficiency_bonus, false, false, `skill_check_${skill}`);

    const success = roll.total >= dc;

    this.log('dice_roll', `${character.name} rolls ${skill}: ${roll.total} vs DC ${dc} — ${success ? 'Success!' : 'Failure.'}`,
      character.id, character.name, { roll: roll.total, dc, skill, success });

    this.emit('check:result', {
      player_id: playerId,
      skill,
      roll: roll.individual_results[0],
      total: roll.total,
      dc,
      success,
    });

    this.emit('game:state_update', { game_state: this.state });
    this.persist();

    return { success, roll: roll.individual_results[0], total: roll.total };
  }

  // ===========================
  // Rest
  // ===========================

  processShortRest(hitDicePerPlayer: Record<string, number>) {
    for (const [charId, dice] of Object.entries(hitDicePerPlayer)) {
      const character = this.state.characters[charId];
      if (character) {
        this.state.characters[charId] = shortRest(character, dice);
      }
    }
    this.state.phase = 'exploration';
    this.log('system', 'The party takes a short rest.');
    this.emit('rest:complete', { type: 'short' });
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  processLongRest() {
    for (const charId of Object.keys(this.state.characters)) {
      this.state.characters[charId] = longRest(this.state.characters[charId]);
    }
    this.state.phase = 'exploration';
    this.log('system', 'The party takes a long rest. All hit points and spell slots restored.');
    this.emit('rest:complete', { type: 'long' });
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  // ===========================
  // Scene Management
  // ===========================

  updateScene(scene: Scene) {
    this.state = { ...this.state, scene };
    this.persist();
  }

  addNarration(text: string, mood?: string) {
    this.log('narration', text);
    this.emit('game:narration', { text, mood });
    this.emit('game:state_update', { game_state: this.state });
    this.persist();
  }

  addNPCDialogue(npcName: string, text: string) {
    this.log('dialogue', `${npcName}: ${text}`);
    this.emit('npc:dialogue', { npc_name: npcName, text });
    this.persist();
  }
}
