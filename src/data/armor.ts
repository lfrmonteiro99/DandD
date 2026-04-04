import { Armor } from '../engine/types';

export const ARMOR_LIST: Armor[] = [
  // Light Armor
  {
    id: 'padded',
    name: 'Padded Armor',
    type: 'light',
    base_ac: 11,
    dex_bonus: true,
    stealth_disadvantage: true,
  },
  {
    id: 'leather',
    name: 'Leather Armor',
    type: 'light',
    base_ac: 11,
    dex_bonus: true,
    stealth_disadvantage: false,
  },
  {
    id: 'studded_leather',
    name: 'Studded Leather',
    type: 'light',
    base_ac: 12,
    dex_bonus: true,
    stealth_disadvantage: false,
  },

  // Medium Armor
  {
    id: 'chain_shirt',
    name: 'Chain Shirt',
    type: 'medium',
    base_ac: 13,
    dex_bonus: true,
    max_dex_bonus: 2,
    stealth_disadvantage: false,
  },
  {
    id: 'scale_mail',
    name: 'Scale Mail',
    type: 'medium',
    base_ac: 14,
    dex_bonus: true,
    max_dex_bonus: 2,
    stealth_disadvantage: true,
  },
  {
    id: 'breastplate',
    name: 'Breastplate',
    type: 'medium',
    base_ac: 14,
    dex_bonus: true,
    max_dex_bonus: 2,
    stealth_disadvantage: false,
  },
  {
    id: 'half_plate',
    name: 'Half Plate',
    type: 'medium',
    base_ac: 15,
    dex_bonus: true,
    max_dex_bonus: 2,
    stealth_disadvantage: true,
  },

  // Heavy Armor
  {
    id: 'chain_mail',
    name: 'Chain Mail',
    type: 'heavy',
    base_ac: 16,
    dex_bonus: false,
    stealth_disadvantage: true,
    strength_requirement: 13,
  },
  {
    id: 'plate',
    name: 'Plate Armor',
    type: 'heavy',
    base_ac: 18,
    dex_bonus: false,
    stealth_disadvantage: true,
    strength_requirement: 15,
  },

  // Shield
  {
    id: 'shield',
    name: 'Shield',
    type: 'shield',
    base_ac: 2,
    dex_bonus: false,
    stealth_disadvantage: false,
  },
];
