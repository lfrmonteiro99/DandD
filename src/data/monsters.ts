import { Monster } from '../engine/types';
import { v4 as uuid } from 'uuid';

export interface MonsterTemplate {
  name: string;
  monster_type: string;
  ac: number;
  max_hp: number;
  speed: number;
  abilities: Monster['abilities'];
  attacks: Monster['attacks'];
  challenge_rating: number;
  xp_value: number;
}

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  goblin: {
    name: 'Goblin',
    monster_type: 'humanoid',
    ac: 15,
    max_hp: 7,
    speed: 30,
    abilities: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    attacks: [
      { name: 'Scimitar', attack_bonus: 4, damage_dice: '1d6+2', damage_type: 'slashing', reach: 5 },
      { name: 'Shortbow', attack_bonus: 4, damage_dice: '1d6+2', damage_type: 'piercing', reach: 80 },
    ],
    challenge_rating: 0.25,
    xp_value: 50,
  },

  skeleton: {
    name: 'Skeleton',
    monster_type: 'undead',
    ac: 13,
    max_hp: 13,
    speed: 30,
    abilities: { strength: 10, dexterity: 14, constitution: 15, intelligence: 6, wisdom: 8, charisma: 5 },
    attacks: [
      { name: 'Shortsword', attack_bonus: 4, damage_dice: '1d6+2', damage_type: 'piercing', reach: 5 },
      { name: 'Shortbow', attack_bonus: 4, damage_dice: '1d6+2', damage_type: 'piercing', reach: 80 },
    ],
    challenge_rating: 0.25,
    xp_value: 50,
  },

  wolf: {
    name: 'Wolf',
    monster_type: 'beast',
    ac: 13,
    max_hp: 11,
    speed: 40,
    abilities: { strength: 12, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
    attacks: [
      { name: 'Bite', attack_bonus: 4, damage_dice: '2d4+2', damage_type: 'piercing', reach: 5 },
    ],
    challenge_rating: 0.25,
    xp_value: 50,
  },

  bandit: {
    name: 'Bandit',
    monster_type: 'humanoid',
    ac: 12,
    max_hp: 11,
    speed: 30,
    abilities: { strength: 11, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    attacks: [
      { name: 'Scimitar', attack_bonus: 3, damage_dice: '1d6+1', damage_type: 'slashing', reach: 5 },
      { name: 'Light Crossbow', attack_bonus: 3, damage_dice: '1d8+1', damage_type: 'piercing', reach: 80 },
    ],
    challenge_rating: 0.125,
    xp_value: 25,
  },

  ogre: {
    name: 'Ogre',
    monster_type: 'giant',
    ac: 11,
    max_hp: 59,
    speed: 40,
    abilities: { strength: 19, dexterity: 8, constitution: 16, intelligence: 5, wisdom: 7, charisma: 7 },
    attacks: [
      { name: 'Greatclub', attack_bonus: 6, damage_dice: '2d8+4', damage_type: 'bludgeoning', reach: 5 },
      { name: 'Javelin', attack_bonus: 6, damage_dice: '2d6+4', damage_type: 'piercing', reach: 30 },
    ],
    challenge_rating: 2,
    xp_value: 450,
  },

  giant_spider: {
    name: 'Giant Spider',
    monster_type: 'beast',
    ac: 14,
    max_hp: 26,
    speed: 30,
    abilities: { strength: 14, dexterity: 16, constitution: 12, intelligence: 2, wisdom: 11, charisma: 4 },
    attacks: [
      { name: 'Bite', attack_bonus: 5, damage_dice: '1d8+3', damage_type: 'piercing', reach: 5 },
    ],
    challenge_rating: 1,
    xp_value: 200,
  },

  zombie: {
    name: 'Zombie',
    monster_type: 'undead',
    ac: 8,
    max_hp: 22,
    speed: 20,
    abilities: { strength: 13, dexterity: 6, constitution: 16, intelligence: 3, wisdom: 6, charisma: 5 },
    attacks: [
      { name: 'Slam', attack_bonus: 3, damage_dice: '1d6+1', damage_type: 'bludgeoning', reach: 5 },
    ],
    challenge_rating: 0.25,
    xp_value: 50,
  },
};

export function createMonsterFromTemplate(templateId: string, nameOverride?: string): Monster {
  const template = MONSTER_TEMPLATES[templateId];
  if (!template) throw new Error(`Unknown monster template: ${templateId}`);

  return {
    id: uuid(),
    name: nameOverride || template.name,
    monster_type: template.monster_type,
    ac: template.ac,
    max_hp: template.max_hp,
    current_hp: template.max_hp,
    speed: template.speed,
    abilities: { ...template.abilities },
    attacks: [...template.attacks],
    challenge_rating: template.challenge_rating,
    xp_value: template.xp_value,
    conditions: [],
  };
}
