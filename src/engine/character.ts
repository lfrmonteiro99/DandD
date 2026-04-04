import {
  Character, CharacterCreateInput, AbilityScores, Ability, Skill,
  Race, CharacterClass, Weapon, Armor, SpellSlotState,
  SKILL_ABILITY_MAP,
} from './types';
import { CLASSES } from '../data/classes';
import { RACES } from '../data/races';
import { WEAPONS } from '../data/weapons';
import { ARMOR_LIST } from '../data/armor';
import { v4 as uuid } from 'uuid';

// Standard Array for ability score assignment
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function calculateMaxHP(cls: CharacterClass, level: number, conModifier: number): number {
  const classDef = CLASSES[cls];
  const hitDieMax = parseInt(classDef.hit_die.slice(1)); // 'd10' -> 10
  const level1HP = hitDieMax + conModifier;
  // Average HP per level after 1st
  const avgPerLevel = Math.floor(hitDieMax / 2) + 1;
  return level1HP + (level - 1) * (avgPerLevel + conModifier);
}

export function calculateAC(character: Character): number {
  if (character.armor) {
    let ac = character.armor.base_ac;
    const dexMod = calculateModifier(character.abilities.dexterity);
    if (character.armor.dex_bonus) {
      ac += character.armor.max_dex_bonus !== undefined
        ? Math.min(dexMod, character.armor.max_dex_bonus)
        : dexMod;
    }
    if (character.shield) ac += character.shield.base_ac;
    return ac;
  }
  // Unarmored
  let ac = 10 + calculateModifier(character.abilities.dexterity);
  if (character.shield) ac += character.shield.base_ac;
  return ac;
}

export function getAbilityModifier(character: Character, ability: Ability): number {
  return calculateModifier(character.abilities[ability]);
}

export function getSkillModifier(character: Character, skill: Skill): number {
  const ability = SKILL_ABILITY_MAP[skill];
  const abilityMod = calculateModifier(character.abilities[ability]);
  const proficient = character.skill_proficiencies.includes(skill);
  return abilityMod + (proficient ? character.proficiency_bonus : 0);
}

export function getAttackModifier(character: Character, weapon: Weapon): number {
  let abilityMod: number;
  if (weapon.ability === 'finesse') {
    const strMod = calculateModifier(character.abilities.strength);
    const dexMod = calculateModifier(character.abilities.dexterity);
    abilityMod = Math.max(strMod, dexMod);
  } else {
    abilityMod = calculateModifier(
      character.abilities[weapon.ability]
    );
  }
  return abilityMod + character.proficiency_bonus;
}

export function getDamageModifier(character: Character, weapon: Weapon): number {
  if (weapon.ability === 'finesse') {
    const strMod = calculateModifier(character.abilities.strength);
    const dexMod = calculateModifier(character.abilities.dexterity);
    return Math.max(strMod, dexMod);
  }
  return calculateModifier(character.abilities[weapon.ability]);
}

export function getSpellcastingModifier(character: Character): number {
  const classDef = CLASSES[character.class];
  if (!classDef.spellcasting_ability) return 0;
  return calculateModifier(character.abilities[classDef.spellcasting_ability]);
}

export function getSpellSaveDC(character: Character): number {
  return 8 + character.proficiency_bonus + getSpellcastingModifier(character);
}

export function getSpellAttackModifier(character: Character): number {
  return character.proficiency_bonus + getSpellcastingModifier(character);
}

function getStartingWeapons(cls: CharacterClass): Weapon[] {
  const classDef = CLASSES[cls];
  return classDef.starting_weapons
    .map(id => WEAPONS.find(w => w.id === id))
    .filter((w): w is Weapon => w !== undefined);
}

function getStartingArmor(cls: CharacterClass): { armor: Armor | null; shield: Armor | null } {
  const classDef = CLASSES[cls];
  const armor = classDef.starting_armor
    ? ARMOR_LIST.find(a => a.id === classDef.starting_armor) || null
    : null;
  const shield = classDef.starting_shield
    ? ARMOR_LIST.find(a => a.id === 'shield') || null
    : null;
  return { armor, shield };
}

function getStartingSpellSlots(cls: CharacterClass, level: number): SpellSlotState {
  const classDef = CLASSES[cls];
  if (!classDef.spell_slots) return {};
  const slots = classDef.spell_slots[level];
  if (!slots) return {};
  const result: SpellSlotState = {};
  for (const [lvl, max] of Object.entries(slots)) {
    result[parseInt(lvl)] = { used: 0, max: max as number };
  }
  return result;
}

export function applyRacialBonuses(abilities: AbilityScores, race: Race): AbilityScores {
  const raceDef = RACES[race];
  const result = { ...abilities };
  for (const [ability, bonus] of Object.entries(raceDef.ability_bonuses)) {
    result[ability as Ability] += bonus;
  }
  return result;
}

export function validateAbilityScores(scores: AbilityScores): boolean {
  const values = Object.values(scores).sort((a, b) => b - a);
  const standard = [...STANDARD_ARRAY].sort((a, b) => b - a);
  return JSON.stringify(values) === JSON.stringify(standard);
}

export function createCharacter(input: CharacterCreateInput): Character {
  const { name, race, class: cls, ability_assignments, session_id, user_id } = input;

  // Apply racial bonuses
  const abilities = applyRacialBonuses(ability_assignments, race);
  const conMod = calculateModifier(abilities.constitution);
  const profBonus = calculateProficiencyBonus(1);
  const maxHP = calculateMaxHP(cls, 1, conMod);
  const raceDef = RACES[race];
  const classDef = CLASSES[cls];
  const { armor, shield } = getStartingArmor(cls);

  const character: Character = {
    id: uuid(),
    user_id,
    session_id,
    name,
    race,
    class: cls,
    level: 1,
    abilities,
    current_hp: maxHP,
    max_hp: maxHP,
    temp_hp: 0,
    armor_class: 0, // calculated below
    speed: raceDef.speed,
    hit_dice_remaining: 1,
    spell_slots: getStartingSpellSlots(cls, 1),
    conditions: [],
    death_saves: { successes: 0, failures: 0 },
    weapons: getStartingWeapons(cls),
    armor,
    shield,
    inventory: [],
    skill_proficiencies: classDef.skill_proficiencies,
    saving_throw_proficiencies: classDef.saving_throw_proficiencies,
    known_spells: classDef.starting_spells || [],
    prepared_spells: classDef.starting_spells || [],
    proficiency_bonus: profBonus,
    experience_points: 0,
  };

  character.armor_class = calculateAC(character);
  return character;
}

export function applyDamage(character: Character, damage: number): Character {
  const updated = { ...character };
  // Apply to temp HP first
  if (updated.temp_hp > 0) {
    if (damage <= updated.temp_hp) {
      updated.temp_hp -= damage;
      return updated;
    }
    damage -= updated.temp_hp;
    updated.temp_hp = 0;
  }
  updated.current_hp = Math.max(0, updated.current_hp - damage);
  if (updated.current_hp === 0 && !updated.conditions.includes('unconscious')) {
    updated.conditions = [...updated.conditions, 'unconscious'];
    updated.death_saves = { successes: 0, failures: 0 };
  }
  return updated;
}

export function applyHealing(character: Character, healing: number): Character {
  const updated = { ...character };
  updated.current_hp = Math.min(updated.max_hp, updated.current_hp + healing);
  if (updated.current_hp > 0) {
    updated.conditions = updated.conditions.filter(c => c !== 'unconscious');
    updated.death_saves = { successes: 0, failures: 0 };
  }
  return updated;
}

export function shortRest(character: Character, hitDiceToSpend: number): Character {
  const updated = { ...character };
  const diceToSpend = Math.min(hitDiceToSpend, updated.hit_dice_remaining);
  const hitDieMax = parseInt(CLASSES[character.class].hit_die.slice(1));
  const conMod = calculateModifier(character.abilities.constitution);

  for (let i = 0; i < diceToSpend; i++) {
    const roll = Math.floor(Math.random() * hitDieMax) + 1;
    const healing = Math.max(1, roll + conMod);
    updated.current_hp = Math.min(updated.max_hp, updated.current_hp + healing);
    updated.hit_dice_remaining--;
  }
  return updated;
}

export function longRest(character: Character): Character {
  const updated = { ...character };
  updated.current_hp = updated.max_hp;
  updated.conditions = [];
  updated.death_saves = { successes: 0, failures: 0 };

  // Recover half hit dice (min 1)
  const totalHitDice = character.level;
  const recover = Math.max(1, Math.floor(totalHitDice / 2));
  updated.hit_dice_remaining = Math.min(totalHitDice, updated.hit_dice_remaining + recover);

  // Recover all spell slots
  const newSlots: SpellSlotState = {};
  for (const [level, slot] of Object.entries(updated.spell_slots)) {
    newSlots[parseInt(level)] = { used: 0, max: slot.max };
  }
  updated.spell_slots = newSlots;

  return updated;
}

export function useSpellSlot(character: Character, level: number): Character | null {
  const slot = character.spell_slots[level];
  if (!slot || slot.used >= slot.max) return null;
  const updated = { ...character };
  updated.spell_slots = {
    ...updated.spell_slots,
    [level]: { ...slot, used: slot.used + 1 },
  };
  return updated;
}
