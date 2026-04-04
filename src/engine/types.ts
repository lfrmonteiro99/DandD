// ===========================
// Core Type Definitions
// ===========================

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type Race = 'human' | 'elf' | 'dwarf' | 'halfling';
export type CharacterClass = 'fighter' | 'wizard' | 'rogue' | 'cleric';
export type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type Skill =
  | 'athletics' | 'acrobatics' | 'sleight_of_hand' | 'stealth'
  | 'arcana' | 'history' | 'investigation' | 'nature' | 'religion'
  | 'animal_handling' | 'insight' | 'medicine' | 'perception' | 'survival'
  | 'deception' | 'intimidation' | 'performance' | 'persuasion';

export type Condition = 'prone' | 'stunned' | 'poisoned' | 'frightened' | 'unconscious' | 'grappled' | 'restrained' | 'blinded' | 'charmed';

export type GamePhase = 'lobby' | 'character_creation' | 'exploration' | 'combat' | 'social' | 'rest' | 'paused';

export type ActionType =
  | 'attack' | 'cast_spell' | 'dash' | 'dodge' | 'disengage'
  | 'help' | 'hide' | 'use_item' | 'free_text' | 'move' | 'talk';

export type SessionStatus = 'lobby' | 'in_progress' | 'paused' | 'completed';

export type DamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'fire' | 'cold' | 'lightning' | 'thunder' | 'poison' | 'acid' | 'necrotic' | 'radiant' | 'psychic' | 'force';

// ===========================
// Ability Scores
// ===========================

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

// ===========================
// Dice
// ===========================

export interface DiceRoll {
  die_type: DieType;
  count: number;
  individual_results: number[];
  modifier: number;
  advantage: boolean;
  disadvantage: boolean;
  total: number;
  is_critical: boolean;
  is_fumble: boolean;
  purpose: string;
}

// ===========================
// Equipment & Items
// ===========================

export interface Weapon {
  id: string;
  name: string;
  damage_die: DieType;
  damage_dice_count: number;
  damage_type: DamageType;
  properties: string[];
  ability: 'strength' | 'dexterity' | 'finesse';
  range?: { normal: number; long: number };
}

export interface Armor {
  id: string;
  name: string;
  type: 'light' | 'medium' | 'heavy' | 'shield';
  base_ac: number;
  dex_bonus: boolean;
  max_dex_bonus?: number;
  stealth_disadvantage: boolean;
  strength_requirement?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  description: string;
}

// ===========================
// Spells
// ===========================

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 = cantrip
  school: string;
  casting_time: string;
  range: string;
  duration: string;
  concentration: boolean;
  description: string;
  damage_die?: DieType;
  damage_dice_count?: number;
  damage_type?: DamageType;
  healing_die?: DieType;
  healing_dice_count?: number;
  save_type?: Ability;
  attack_roll: boolean;
  classes: CharacterClass[];
}

export interface SpellSlotState {
  [level: number]: { used: number; max: number };
}

// ===========================
// Character
// ===========================

export interface Character {
  id: string;
  user_id: string;
  session_id: string;
  name: string;
  race: Race;
  class: CharacterClass;
  level: number;
  abilities: AbilityScores;
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  armor_class: number;
  speed: number;
  hit_dice_remaining: number;
  spell_slots: SpellSlotState;
  conditions: Condition[];
  death_saves: { successes: number; failures: number };
  weapons: Weapon[];
  armor: Armor | null;
  shield: Armor | null;
  inventory: InventoryItem[];
  skill_proficiencies: Skill[];
  saving_throw_proficiencies: Ability[];
  known_spells: string[];
  prepared_spells: string[];
  proficiency_bonus: number;
  experience_points: number;
}

// ===========================
// Monster
// ===========================

export interface MonsterAttack {
  name: string;
  attack_bonus: number;
  damage_dice: string; // e.g. "1d6+2"
  damage_type: DamageType;
  reach: number;
}

export interface Monster {
  id: string;
  name: string;
  monster_type: string;
  ac: number;
  max_hp: number;
  current_hp: number;
  speed: number;
  abilities: AbilityScores;
  attacks: MonsterAttack[];
  challenge_rating: number;
  xp_value: number;
  conditions: Condition[];
}

// ===========================
// NPC
// ===========================

export interface NPC {
  id: string;
  name: string;
  description: string;
  disposition: 'friendly' | 'neutral' | 'hostile';
  personality: string;
  dialogue_history: string[];
}

// ===========================
// Combat
// ===========================

export interface InitiativeEntry {
  entity_id: string;
  entity_type: 'player' | 'monster';
  entity_name: string;
  initiative_roll: number;
  dex_modifier: number;
  has_acted_this_round: boolean;
}

export interface CombatState {
  round: number;
  initiative_order: InitiativeEntry[];
  current_turn_index: number;
  combat_log: CombatLogEntry[];
  monsters: Monster[];
}

export interface CombatLogEntry {
  round: number;
  actor_id: string;
  actor_name: string;
  action: ActionType;
  target_id: string | null;
  target_name: string | null;
  rolls: DiceRoll[];
  result: CombatResult;
  narration: string;
  timestamp: number;
}

export interface CombatResult {
  hit: boolean | null;
  damage: number | null;
  damage_type: DamageType | null;
  conditions_applied: Condition[];
  conditions_removed: Condition[];
  target_killed: boolean;
  target_unconscious: boolean;
  healing: number | null;
}

// ===========================
// Scene
// ===========================

export interface Scene {
  id: string;
  name: string;
  description: string;
  type: 'dungeon' | 'town' | 'wilderness' | 'interior';
  npcs: NPC[];
  monsters_present: string[];
  exits: { direction: string; description: string }[];
}

// ===========================
// Game State
// ===========================

export interface GameState {
  session_id: string;
  phase: GamePhase;
  scene: Scene | null;
  combat: CombatState | null;
  characters: Record<string, Character>;
  npcs: Record<string, NPC>;
  recent_log: GameLogEntry[];
  round_number: number;
}

export interface GameLogEntry {
  id: string;
  session_id: string;
  timestamp: number;
  type: 'narration' | 'player_action' | 'dice_roll' | 'combat_action' | 'system' | 'dialogue' | 'player_chat';
  actor_id: string | null;
  actor_name: string | null;
  content: string;
  mechanical_data?: Record<string, unknown>;
}

// ===========================
// Session
// ===========================

export interface GameSession {
  id: string;
  name: string;
  created_by: string;
  status: SessionStatus;
  max_players: number;
  players: SessionPlayer[];
  game_state: GameState | null;
  created_at: number;
  updated_at: number;
}

export interface SessionPlayer {
  user_id: string;
  username: string;
  character_id: string | null;
  is_connected: boolean;
  is_ready: boolean;
  joined_at: number;
}

// ===========================
// Player Actions
// ===========================

export interface PlayerAction {
  player_id: string;
  action_type: ActionType;
  target_id?: string;
  details?: Record<string, unknown>;
}

// ===========================
// AI DM Response
// ===========================

export interface DMResponse {
  narration: string;
  dm_decisions: {
    npc_actions?: { npc_id: string; action: string; target?: string }[];
    dc_assignments?: { check: Skill | Ability; dc: number }[];
    scene_changes?: { description?: string; new_npcs?: NPC[] };
    encounter_trigger?: { monsters: string[]; description: string } | null;
    check_required?: { skill: Skill; dc: number; player_id: string } | null;
  };
  mood?: string;
}

export interface MonsterActionDecision {
  monster_id: string;
  action: 'attack' | 'move' | 'flee' | 'special';
  target_id?: string;
  attack_name?: string;
}

// ===========================
// Character Creation Input
// ===========================

export interface CharacterCreateInput {
  name: string;
  race: Race;
  class: CharacterClass;
  ability_assignments: AbilityScores;
  session_id: string;
  user_id: string;
}

// ===========================
// Skill to Ability Mapping
// ===========================

export const SKILL_ABILITY_MAP: Record<Skill, Ability> = {
  athletics: 'strength',
  acrobatics: 'dexterity',
  sleight_of_hand: 'dexterity',
  stealth: 'dexterity',
  arcana: 'intelligence',
  history: 'intelligence',
  investigation: 'intelligence',
  nature: 'intelligence',
  religion: 'intelligence',
  animal_handling: 'wisdom',
  insight: 'wisdom',
  medicine: 'wisdom',
  perception: 'wisdom',
  survival: 'wisdom',
  deception: 'charisma',
  intimidation: 'charisma',
  performance: 'charisma',
  persuasion: 'charisma',
};
