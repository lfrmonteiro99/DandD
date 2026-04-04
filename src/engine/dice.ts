import { DiceRoll, DieType } from './types';

const DIE_MAX: Record<DieType, number> = {
  d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100,
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollDie(type: DieType): number {
  return randomInt(1, DIE_MAX[type]);
}

export function rollDice(
  type: DieType,
  count: number,
  modifier: number = 0,
  purpose: string = 'generic'
): DiceRoll {
  const results = Array.from({ length: count }, () => rollDie(type));
  const sum = results.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  const isD20 = type === 'd20' && count === 1;

  return {
    die_type: type,
    count,
    individual_results: results,
    modifier,
    advantage: false,
    disadvantage: false,
    total,
    is_critical: isD20 && results[0] === 20,
    is_fumble: isD20 && results[0] === 1,
    purpose,
  };
}

export function rollD20(
  modifier: number = 0,
  purpose: string = 'check'
): DiceRoll {
  return rollDice('d20', 1, modifier, purpose);
}

export function rollWithAdvantage(
  modifier: number = 0,
  purpose: string = 'check'
): DiceRoll {
  const roll1 = rollDie('d20');
  const roll2 = rollDie('d20');
  const chosen = Math.max(roll1, roll2);
  const total = chosen + modifier;

  return {
    die_type: 'd20',
    count: 2,
    individual_results: [roll1, roll2],
    modifier,
    advantage: true,
    disadvantage: false,
    total,
    is_critical: chosen === 20,
    is_fumble: chosen === 1,
    purpose,
  };
}

export function rollWithDisadvantage(
  modifier: number = 0,
  purpose: string = 'check'
): DiceRoll {
  const roll1 = rollDie('d20');
  const roll2 = rollDie('d20');
  const chosen = Math.min(roll1, roll2);
  const total = chosen + modifier;

  return {
    die_type: 'd20',
    count: 2,
    individual_results: [roll1, roll2],
    modifier,
    advantage: false,
    disadvantage: true,
    total,
    is_critical: chosen === 20,
    is_fumble: chosen === 1,
    purpose,
  };
}

export function rollAbilityCheck(
  abilityModifier: number,
  proficient: boolean,
  proficiencyBonus: number,
  advantage: boolean = false,
  disadvantage: boolean = false,
  purpose: string = 'ability_check'
): DiceRoll {
  const totalMod = abilityModifier + (proficient ? proficiencyBonus : 0);

  if (advantage && !disadvantage) {
    return rollWithAdvantage(totalMod, purpose);
  }
  if (disadvantage && !advantage) {
    return rollWithDisadvantage(totalMod, purpose);
  }
  return rollD20(totalMod, purpose);
}

export function rollInitiative(dexModifier: number): DiceRoll {
  return rollD20(dexModifier, 'initiative');
}

export function rollDamage(
  dieType: DieType,
  diceCount: number,
  modifier: number,
  critical: boolean = false
): DiceRoll {
  const actualCount = critical ? diceCount * 2 : diceCount;
  return rollDice(dieType, actualCount, modifier, 'damage');
}

export function rollDeathSave(): DiceRoll {
  return rollD20(0, 'death_save');
}

/** Parse a damage string like "2d6+3" into components */
export function parseDamageString(damage: string): { count: number; die: DieType; modifier: number } {
  const match = damage.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { count: 1, die: 'd6', modifier: 0 };

  return {
    count: parseInt(match[1]),
    die: `d${match[2]}` as DieType,
    modifier: match[3] ? parseInt(match[3]) : 0,
  };
}
