import { CharacterClass, Ability, Skill } from '../engine/types';

export interface ClassDefinition {
  name: string;
  hit_die: string;
  primary_ability: Ability;
  saving_throw_proficiencies: Ability[];
  skill_proficiencies: Skill[];
  armor_proficiencies: string[];
  weapon_proficiencies: string[];
  starting_weapons: string[];
  starting_armor: string | null;
  starting_shield: boolean;
  spellcasting_ability: Ability | null;
  spell_slots?: Record<number, Record<number, number>>;
  starting_spells?: string[];
  features: { name: string; description: string }[];
  description: string;
}

export const CLASSES: Record<CharacterClass, ClassDefinition> = {
  fighter: {
    name: 'Fighter',
    hit_die: 'd10',
    primary_ability: 'strength',
    saving_throw_proficiencies: ['strength', 'constitution'],
    skill_proficiencies: ['athletics', 'perception'],
    armor_proficiencies: ['light', 'medium', 'heavy', 'shield'],
    weapon_proficiencies: ['simple', 'martial'],
    starting_weapons: ['longsword', 'handaxe'],
    starting_armor: 'chain_mail',
    starting_shield: true,
    spellcasting_ability: null,
    features: [
      { name: 'Fighting Style: Defense', description: 'While wearing armor, +1 bonus to AC.' },
      { name: 'Second Wind', description: 'Once per short rest, use a bonus action to regain 1d10 + fighter level HP.' },
    ],
    description: 'A master of martial combat, skilled with a variety of weapons and armor.',
  },

  wizard: {
    name: 'Wizard',
    hit_die: 'd6',
    primary_ability: 'intelligence',
    saving_throw_proficiencies: ['intelligence', 'wisdom'],
    skill_proficiencies: ['arcana', 'investigation'],
    armor_proficiencies: [],
    weapon_proficiencies: ['dagger', 'quarterstaff'],
    starting_weapons: ['quarterstaff'],
    starting_armor: null,
    starting_shield: false,
    spellcasting_ability: 'intelligence',
    spell_slots: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
    },
    starting_spells: ['fire_bolt', 'ray_of_frost', 'mage_hand', 'magic_missile', 'shield', 'sleep'],
    features: [
      { name: 'Arcane Recovery', description: 'Once per day during a short rest, recover spell slots with combined level equal to half wizard level (rounded up).' },
      { name: 'Spellcasting', description: 'You can cast wizard spells using Intelligence as your spellcasting ability.' },
    ],
    description: 'A scholarly magic-user capable of manipulating the structures of reality.',
  },

  rogue: {
    name: 'Rogue',
    hit_die: 'd8',
    primary_ability: 'dexterity',
    saving_throw_proficiencies: ['dexterity', 'intelligence'],
    skill_proficiencies: ['stealth', 'perception', 'sleight_of_hand', 'acrobatics'],
    armor_proficiencies: ['light'],
    weapon_proficiencies: ['simple', 'hand_crossbow', 'longsword', 'rapier', 'shortsword'],
    starting_weapons: ['shortsword', 'dagger'],
    starting_armor: 'leather',
    starting_shield: false,
    spellcasting_ability: null,
    features: [
      { name: 'Sneak Attack', description: 'Once per turn, deal extra 1d6 damage when you hit with a finesse or ranged weapon and have advantage, or an ally is within 5 ft of the target.' },
      { name: 'Expertise', description: 'Double your proficiency bonus for two chosen skill proficiencies.' },
      { name: 'Thieves\' Cant', description: 'A secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.' },
    ],
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
  },

  cleric: {
    name: 'Cleric',
    hit_die: 'd8',
    primary_ability: 'wisdom',
    saving_throw_proficiencies: ['wisdom', 'charisma'],
    skill_proficiencies: ['insight', 'medicine'],
    armor_proficiencies: ['light', 'medium', 'shield'],
    weapon_proficiencies: ['simple'],
    starting_weapons: ['mace'],
    starting_armor: 'scale_mail',
    starting_shield: true,
    spellcasting_ability: 'wisdom',
    spell_slots: {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
    },
    starting_spells: ['sacred_flame', 'guidance', 'spare_the_dying', 'cure_wounds', 'bless', 'guiding_bolt'],
    features: [
      { name: 'Spellcasting', description: 'You can cast cleric spells using Wisdom as your spellcasting ability.' },
      { name: 'Channel Divinity: Turn Undead', description: 'Each undead within 30 ft must make a Wisdom saving throw or be turned for 1 minute.' },
    ],
    description: 'A priestly champion who wields divine magic in service of a higher power.',
  },
};
