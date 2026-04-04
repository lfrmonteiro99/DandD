import { Race, Ability } from '../engine/types';

export interface RaceDefinition {
  name: string;
  ability_bonuses: Partial<Record<Ability, number>>;
  speed: number;
  traits: { name: string; description: string }[];
  description: string;
}

export const RACES: Record<Race, RaceDefinition> = {
  human: {
    name: 'Human',
    ability_bonuses: {
      strength: 1,
      dexterity: 1,
      constitution: 1,
      intelligence: 1,
      wisdom: 1,
      charisma: 1,
    },
    speed: 30,
    traits: [
      { name: 'Versatile', description: '+1 to all ability scores.' },
    ],
    description: 'Humans are the most adaptable and ambitious people among the common races.',
  },

  elf: {
    name: 'Elf',
    ability_bonuses: {
      dexterity: 2,
    },
    speed: 30,
    traits: [
      { name: 'Darkvision', description: 'You can see in dim light within 60 feet as if it were bright light.' },
      { name: 'Fey Ancestry', description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.' },
      { name: 'Keen Senses', description: 'You have proficiency in the Perception skill.' },
      { name: 'Trance', description: 'Elves don\'t need to sleep. They meditate deeply for 4 hours a day.' },
    ],
    description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
  },

  dwarf: {
    name: 'Dwarf',
    ability_bonuses: {
      constitution: 2,
    },
    speed: 25,
    traits: [
      { name: 'Darkvision', description: 'You can see in dim light within 60 feet as if it were bright light.' },
      { name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and resistance against poison damage.' },
      { name: 'Stonecunning', description: 'Whenever you make a History check related to stonework, add double your proficiency bonus.' },
    ],
    description: 'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.',
  },

  halfling: {
    name: 'Halfling',
    ability_bonuses: {
      dexterity: 2,
    },
    speed: 25,
    traits: [
      { name: 'Lucky', description: 'When you roll a 1 on a d20 for an attack roll, ability check, or saving throw, you can reroll and must use the new roll.' },
      { name: 'Brave', description: 'You have advantage on saving throws against being frightened.' },
      { name: 'Halfling Nimbleness', description: 'You can move through the space of any creature that is of a size larger than yours.' },
    ],
    description: 'The comforts of home are the goals of most halflings\' lives: a place to settle in peace and quiet.',
  },
};
