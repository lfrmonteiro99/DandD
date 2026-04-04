import {
  Character, Monster, CombatState, CombatResult, CombatLogEntry,
  InitiativeEntry, DiceRoll, Weapon, ActionType, MonsterAttack,
} from './types';
import {
  rollInitiative, rollD20, rollDamage, rollDeathSave,
  rollWithAdvantage, rollWithDisadvantage, parseDamageString,
} from './dice';
import {
  calculateModifier, getAttackModifier, getDamageModifier,
  applyDamage as applyCharDamage, applyHealing as applyCharHealing,
} from './character';

// ===========================
// Initiative
// ===========================

export function rollInitiativeForAll(
  characters: Character[],
  monsters: Monster[]
): InitiativeEntry[] {
  const entries: InitiativeEntry[] = [];

  for (const char of characters) {
    if (char.current_hp <= 0) continue;
    const dexMod = calculateModifier(char.abilities.dexterity);
    const roll = rollInitiative(dexMod);
    entries.push({
      entity_id: char.id,
      entity_type: 'player',
      entity_name: char.name,
      initiative_roll: roll.total,
      dex_modifier: dexMod,
      has_acted_this_round: false,
    });
  }

  for (const monster of monsters) {
    if (monster.current_hp <= 0) continue;
    const dexMod = calculateModifier(monster.abilities.dexterity);
    const roll = rollInitiative(dexMod);
    entries.push({
      entity_id: monster.id,
      entity_type: 'monster',
      entity_name: monster.name,
      initiative_roll: roll.total,
      dex_modifier: dexMod,
      has_acted_this_round: false,
    });
  }

  // Sort by initiative (higher first), tiebreak by DEX modifier
  entries.sort((a, b) => {
    if (b.initiative_roll !== a.initiative_roll) return b.initiative_roll - a.initiative_roll;
    return b.dex_modifier - a.dex_modifier;
  });

  return entries;
}

export function createCombatState(
  characters: Character[],
  monsters: Monster[]
): CombatState {
  return {
    round: 1,
    initiative_order: rollInitiativeForAll(characters, monsters),
    current_turn_index: 0,
    combat_log: [],
    monsters,
  };
}

export function getCurrentTurnEntity(combat: CombatState): InitiativeEntry {
  return combat.initiative_order[combat.current_turn_index];
}

export function advanceTurn(combat: CombatState): CombatState {
  const updated = { ...combat };
  updated.initiative_order = [...combat.initiative_order];
  updated.initiative_order[combat.current_turn_index] = {
    ...updated.initiative_order[combat.current_turn_index],
    has_acted_this_round: true,
  };

  let nextIndex = combat.current_turn_index + 1;

  // Skip dead entities
  while (nextIndex < updated.initiative_order.length) {
    const entry = updated.initiative_order[nextIndex];
    // Check if entity is still alive (we'll need to verify externally)
    break;
  }

  if (nextIndex >= updated.initiative_order.length) {
    // New round
    updated.round = combat.round + 1;
    updated.current_turn_index = 0;
    updated.initiative_order = updated.initiative_order.map(e => ({
      ...e,
      has_acted_this_round: false,
    }));
  } else {
    updated.current_turn_index = nextIndex;
  }

  return updated;
}

// ===========================
// Attack Resolution
// ===========================

export interface AttackResult {
  roll: DiceRoll;
  damageRoll: DiceRoll | null;
  result: CombatResult;
}

export function resolvePlayerAttack(
  attacker: Character,
  target: Monster,
  weapon: Weapon
): AttackResult {
  const attackMod = getAttackModifier(attacker, weapon);
  const hasAdvantage = false; // Can be extended with conditions
  const hasDisadvantage = attacker.conditions.includes('poisoned') ||
    attacker.conditions.includes('prone') ||
    attacker.conditions.includes('frightened');

  let attackRoll: DiceRoll;
  if (hasAdvantage && !hasDisadvantage) {
    attackRoll = rollWithAdvantage(attackMod, 'attack_roll');
  } else if (hasDisadvantage && !hasAdvantage) {
    attackRoll = rollWithDisadvantage(attackMod, 'attack_roll');
  } else {
    attackRoll = rollD20(attackMod, 'attack_roll');
  }

  const result: CombatResult = {
    hit: null,
    damage: null,
    damage_type: weapon.damage_type,
    conditions_applied: [],
    conditions_removed: [],
    target_killed: false,
    target_unconscious: false,
    healing: null,
  };

  // Natural 1 = auto miss
  if (attackRoll.is_fumble) {
    result.hit = false;
    return { roll: attackRoll, damageRoll: null, result };
  }

  // Natural 20 = auto hit + crit
  const hit = attackRoll.is_critical || attackRoll.total >= target.ac;
  result.hit = hit;

  if (!hit) {
    return { roll: attackRoll, damageRoll: null, result };
  }

  // Damage
  const damageMod = getDamageModifier(attacker, weapon);
  const damageRoll = rollDamage(
    weapon.damage_die,
    weapon.damage_dice_count,
    damageMod,
    attackRoll.is_critical
  );

  result.damage = Math.max(1, damageRoll.total);
  const newHP = target.current_hp - result.damage;
  result.target_killed = newHP <= 0;

  return { roll: attackRoll, damageRoll, result };
}

export function resolveMonsterAttack(
  monster: Monster,
  attack: MonsterAttack,
  target: Character
): AttackResult {
  const attackRoll = rollD20(attack.attack_bonus, 'attack_roll');

  const result: CombatResult = {
    hit: null,
    damage: null,
    damage_type: attack.damage_type,
    conditions_applied: [],
    conditions_removed: [],
    target_killed: false,
    target_unconscious: false,
    healing: null,
  };

  if (attackRoll.is_fumble) {
    result.hit = false;
    return { roll: attackRoll, damageRoll: null, result };
  }

  const targetAC = target.armor_class;
  const hit = attackRoll.is_critical || attackRoll.total >= targetAC;
  result.hit = hit;

  if (!hit) {
    return { roll: attackRoll, damageRoll: null, result };
  }

  const parsed = parseDamageString(attack.damage_dice);
  const damageRoll = rollDamage(parsed.die, parsed.count, parsed.modifier, attackRoll.is_critical);
  result.damage = Math.max(1, damageRoll.total);

  const updatedTarget = applyCharDamage(target, result.damage);
  result.target_unconscious = updatedTarget.current_hp <= 0;
  result.target_killed = false; // Players go unconscious, not dead (death saves)

  return { roll: attackRoll, damageRoll, result };
}

// ===========================
// Death Saves
// ===========================

export interface DeathSaveResult {
  roll: DiceRoll;
  successes: number;
  failures: number;
  stabilized: boolean;
  revived: boolean;
  dead: boolean;
}

export function processDeathSave(character: Character): DeathSaveResult {
  const roll = rollDeathSave();
  const saves = { ...character.death_saves };

  if (roll.individual_results[0] === 20) {
    // Natural 20: revive with 1 HP
    return {
      roll,
      successes: saves.successes,
      failures: saves.failures,
      stabilized: false,
      revived: true,
      dead: false,
    };
  }

  if (roll.individual_results[0] === 1) {
    saves.failures += 2;
  } else if (roll.total >= 10) {
    saves.successes += 1;
  } else {
    saves.failures += 1;
  }

  return {
    roll,
    successes: saves.successes,
    failures: saves.failures,
    stabilized: saves.successes >= 3,
    revived: false,
    dead: saves.failures >= 3,
  };
}

// ===========================
// Combat End Check
// ===========================

export function checkCombatEnd(
  characters: Character[],
  monsters: Monster[]
): { ended: boolean; playersWin: boolean } {
  const allMonstersDead = monsters.every(m => m.current_hp <= 0);
  const allPlayersDown = characters.every(c => c.current_hp <= 0);

  if (allMonstersDead) return { ended: true, playersWin: true };
  if (allPlayersDown) return { ended: true, playersWin: false };
  return { ended: false, playersWin: false };
}

// ===========================
// Apply Results to State
// ===========================

export function applyDamageToMonster(monster: Monster, damage: number): Monster {
  return {
    ...monster,
    current_hp: Math.max(0, monster.current_hp - damage),
    conditions: monster.current_hp - damage <= 0
      ? [...monster.conditions, 'unconscious']
      : monster.conditions,
  };
}

export function applyDamageToCharacter(character: Character, damage: number): Character {
  return applyCharDamage(character, damage);
}

export function applyHealingToCharacter(character: Character, healing: number): Character {
  return applyCharHealing(character, healing);
}

export function createCombatLogEntry(
  round: number,
  actor_id: string,
  actor_name: string,
  action: ActionType,
  target_id: string | null,
  target_name: string | null,
  rolls: DiceRoll[],
  result: CombatResult,
  narration: string
): CombatLogEntry {
  return {
    round,
    actor_id,
    actor_name,
    action,
    target_id,
    target_name,
    rolls,
    result,
    narration,
    timestamp: Date.now(),
  };
}
