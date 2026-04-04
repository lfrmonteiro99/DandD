# Data Models

## Overview

All models are defined as TypeScript interfaces (for implementation) and PostgreSQL schemas (for persistence). The game engine operates on in-memory objects; the database provides persistence and session recovery.

---

## 1. Player / User

```typescript
interface User {
  id: string;                  // UUID
  username: string;            // Display name
  email: string;               // For auth
  created_at: Date;
  last_active: Date;
}
```

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);
```

---

## 2. Character

```typescript
interface Character {
  id: string;                  // UUID
  user_id: string;             // Owner
  session_id: string;          // Belongs to session
  name: string;
  race: Race;                  // 'human' | 'elf' | 'dwarf' | 'halfling'
  class: CharacterClass;       // 'fighter' | 'wizard' | 'rogue' | 'cleric'
  level: number;               // Starts at 1
  
  // Ability Scores
  abilities: {
    strength: number;          // 3-20
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };

  // Derived Stats (calculated by engine, not stored)
  // hp, max_hp, ac, initiative_modifier, proficiency_bonus, etc.

  // Mutable State
  current_hp: number;
  temp_hp: number;
  hit_dice_remaining: number;
  spell_slots: SpellSlotState;
  conditions: Condition[];
  death_saves: { successes: number; failures: number };

  // Equipment
  equipment: Equipment[];
  inventory: InventoryItem[];
  
  // Proficiencies
  skill_proficiencies: Skill[];
  saving_throw_proficiencies: Ability[];
  weapon_proficiencies: string[];
  armor_proficiencies: string[];

  // Spells (for casters)
  known_spells: string[];      // Spell IDs
  prepared_spells: string[];   // Subset of known (for Cleric/Wizard)

  created_at: Date;
}

type Race = 'human' | 'elf' | 'dwarf' | 'halfling';
type CharacterClass = 'fighter' | 'wizard' | 'rogue' | 'cleric';
type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
type Condition = 'prone' | 'stunned' | 'poisoned' | 'frightened' | 'unconscious' | 'grappled';

type Skill = 
  | 'athletics' | 'acrobatics' | 'sleight_of_hand' | 'stealth'
  | 'arcana' | 'history' | 'investigation' | 'nature' | 'religion'
  | 'animal_handling' | 'insight' | 'medicine' | 'perception' | 'survival'
  | 'deception' | 'intimidation' | 'performance' | 'persuasion';

interface SpellSlotState {
  level_1: { used: number; max: number };
  level_2: { used: number; max: number };
  // ... up to level 9 (but MVP only needs 1-2)
}

interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'other';
  equipped: boolean;
  properties: Record<string, any>;  // damage_die, ac_bonus, etc.
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight: number;
  description: string;
}
```

```sql
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  race VARCHAR(20) NOT NULL,
  class VARCHAR(20) NOT NULL,
  level INT DEFAULT 1,
  
  -- Ability scores stored as JSON
  abilities JSONB NOT NULL,
  
  -- Mutable state
  current_hp INT NOT NULL,
  temp_hp INT DEFAULT 0,
  hit_dice_remaining INT NOT NULL,
  spell_slots JSONB DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  death_saves JSONB DEFAULT '{"successes": 0, "failures": 0}',
  
  -- Equipment and inventory as JSON
  equipment JSONB DEFAULT '[]',
  inventory JSONB DEFAULT '[]',
  
  -- Proficiencies
  skill_proficiencies JSONB DEFAULT '[]',
  saving_throw_proficiencies JSONB DEFAULT '[]',
  weapon_proficiencies JSONB DEFAULT '[]',
  armor_proficiencies JSONB DEFAULT '[]',
  
  -- Spells
  known_spells JSONB DEFAULT '[]',
  prepared_spells JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Game Session

```typescript
interface GameSession {
  id: string;                    // UUID
  name: string;                  // "Thorin's Adventure"
  created_by: string;            // User ID of creator
  status: SessionStatus;
  max_players: number;           // 1-4 for MVP
  
  // Connected players
  players: SessionPlayer[];
  
  // Current game state
  game_state: GameState;
  
  // Campaign info
  campaign_id: string | null;    // For multi-session campaigns
  
  created_at: Date;
  updated_at: Date;
}

type SessionStatus = 'lobby' | 'in_progress' | 'paused' | 'completed';

interface SessionPlayer {
  user_id: string;
  character_id: string;
  is_connected: boolean;
  joined_at: Date;
}
```

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  created_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'lobby',
  max_players INT DEFAULT 4,
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE session_players (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);
```

---

## 4. Game State

The central state object that the game engine operates on. Stored in memory during active play, persisted to DB on every significant change.

```typescript
interface GameState {
  session_id: string;
  phase: GamePhase;
  
  // Current scene
  scene: Scene;
  
  // Combat state (null if not in combat)
  combat: CombatState | null;
  
  // All characters in the session (players + NPCs)
  characters: Map<string, Character>;
  npcs: Map<string, NPC>;
  monsters: Map<string, Monster>;
  
  // Game log (last N entries for context)
  recent_log: GameLogEntry[];
  
  // Turn counter
  round_number: number;
}

type GamePhase = 'exploration' | 'combat' | 'social' | 'rest' | 'character_creation' | 'lobby';

interface Scene {
  id: string;
  name: string;
  description: string;
  type: 'dungeon' | 'town' | 'wilderness' | 'interior';
  npcs_present: string[];       // NPC IDs
  monsters_present: string[];   // Monster IDs
  exits: SceneExit[];
  items: SceneItem[];
  environment_effects: string[];
}

interface SceneExit {
  direction: string;            // "north", "through the door", etc.
  target_scene_id: string | null; // null = AI will generate
  description: string;
  locked: boolean;
  dc_to_unlock: number | null;
}
```

---

## 5. Combat State

```typescript
interface CombatState {
  round: number;
  initiative_order: InitiativeEntry[];
  current_turn_index: number;
  
  // Pending actions for current turn
  pending_action: PendingAction | null;
  
  // Combat log for this encounter
  combat_log: CombatLogEntry[];
}

interface InitiativeEntry {
  entity_id: string;            // Character, NPC, or Monster ID
  entity_type: 'player' | 'npc' | 'monster';
  initiative_roll: number;
  dex_modifier: number;
  is_surprised: boolean;
  has_acted_this_round: boolean;
}

interface PendingAction {
  actor_id: string;
  action_type: ActionType;
  target_id: string | null;
  details: Record<string, any>;
}

type ActionType = 
  | 'attack'
  | 'cast_spell'
  | 'dash'
  | 'dodge'
  | 'disengage'
  | 'help'
  | 'hide'
  | 'use_item'
  | 'free_text';

interface CombatLogEntry {
  round: number;
  actor_id: string;
  action: ActionType;
  target_id: string | null;
  rolls: DiceRoll[];
  result: CombatResult;
  narration: string;
  timestamp: Date;
}

interface CombatResult {
  hit: boolean | null;
  damage: number | null;
  damage_type: string | null;
  conditions_applied: Condition[];
  conditions_removed: Condition[];
  target_killed: boolean;
  target_unconscious: boolean;
  healing: number | null;
}
```

---

## 6. Dice Rolls

```typescript
interface DiceRoll {
  die_type: DieType;            // 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
  count: number;                // Number of dice rolled
  individual_results: number[]; // Each die result
  modifier: number;             // Added after sum
  advantage: boolean;
  disadvantage: boolean;
  total: number;                // Final result
  is_critical: boolean;         // Natural 20
  is_fumble: boolean;           // Natural 1
  purpose: string;              // "attack_roll", "damage", "initiative", "ability_check"
}

type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
```

---

## 7. NPCs and Monsters

```typescript
interface NPC {
  id: string;
  name: string;
  description: string;
  disposition: 'friendly' | 'neutral' | 'hostile';
  personality: string;          // For AI roleplay context
  location: string;             // Scene ID
  dialogue_history: string[];   // Recent exchanges for context
  quest_relevant: boolean;
}

interface Monster {
  id: string;
  name: string;
  monster_type: string;         // "goblin", "skeleton", etc.
  
  // Stats (from monster stat block)
  ac: number;
  max_hp: number;
  current_hp: number;
  speed: number;
  
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  
  // Combat
  attacks: MonsterAttack[];
  challenge_rating: number;     // CR for XP calculation
  xp_value: number;
  
  conditions: Condition[];
}

interface MonsterAttack {
  name: string;                 // "Scimitar", "Bite"
  attack_bonus: number;         // +4
  damage_dice: string;          // "1d6+2"
  damage_type: string;          // "slashing"
  reach: number;                // 5 (feet)
}
```

### Monster Stat Blocks (MVP Set)

```typescript
const MONSTER_TEMPLATES: Record<string, Omit<Monster, 'id' | 'current_hp' | 'conditions'>> = {
  goblin: {
    name: "Goblin",
    monster_type: "goblin",
    ac: 15, max_hp: 7, speed: 30,
    abilities: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    attacks: [{ name: "Scimitar", attack_bonus: 4, damage_dice: "1d6+2", damage_type: "slashing", reach: 5 }],
    challenge_rating: 0.25, xp_value: 50
  },
  skeleton: {
    name: "Skeleton",
    monster_type: "skeleton",
    ac: 13, max_hp: 13, speed: 30,
    abilities: { strength: 10, dexterity: 14, constitution: 15, intelligence: 6, wisdom: 8, charisma: 5 },
    attacks: [{ name: "Shortsword", attack_bonus: 4, damage_dice: "1d6+2", damage_type: "piercing", reach: 5 }],
    challenge_rating: 0.25, xp_value: 50
  },
  wolf: {
    name: "Wolf",
    monster_type: "wolf",
    ac: 13, max_hp: 11, speed: 40,
    abilities: { strength: 12, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
    attacks: [{ name: "Bite", attack_bonus: 4, damage_dice: "2d4+2", damage_type: "piercing", reach: 5 }],
    challenge_rating: 0.25, xp_value: 50
  },
  bandit: {
    name: "Bandit",
    monster_type: "bandit",
    ac: 12, max_hp: 11, speed: 30,
    abilities: { strength: 11, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
    attacks: [{ name: "Scimitar", attack_bonus: 3, damage_dice: "1d6+1", damage_type: "slashing", reach: 5 }],
    challenge_rating: 0.125, xp_value: 25
  },
  ogre: {
    name: "Ogre",
    monster_type: "ogre",
    ac: 11, max_hp: 59, speed: 40,
    abilities: { strength: 19, dexterity: 8, constitution: 16, intelligence: 5, wisdom: 7, charisma: 7 },
    attacks: [{ name: "Greatclub", attack_bonus: 6, damage_dice: "2d8+4", damage_type: "bludgeoning", reach: 5 }],
    challenge_rating: 2, xp_value: 450
  }
};
```

---

## 8. Game Log

```typescript
interface GameLogEntry {
  id: string;
  session_id: string;
  timestamp: Date;
  type: LogEntryType;
  actor_id: string | null;      // Who performed the action
  content: string;              // Narration text or action description
  mechanical_data: Record<string, any> | null;  // Dice rolls, damage, etc.
  visibility: 'all' | 'dm_only' | 'player_only';
}

type LogEntryType = 
  | 'narration'        // DM narration
  | 'player_action'    // Player declared action
  | 'dice_roll'        // Dice roll result
  | 'combat_action'    // Combat resolution
  | 'system'           // Phase change, player join/leave
  | 'dialogue'         // NPC dialogue
  | 'player_chat';     // Player out-of-character chat
```

```sql
CREATE TABLE game_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  actor_id UUID,
  content TEXT NOT NULL,
  mechanical_data JSONB,
  visibility VARCHAR(20) DEFAULT 'all',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_log_session ON game_log(session_id, created_at);
```

---

## 9. Campaign (Future)

```typescript
interface Campaign {
  id: string;
  name: string;
  description: string;
  created_by: string;
  sessions: string[];           // Ordered session IDs
  world_state: Record<string, any>;  // Persistent world changes
  created_at: Date;
}
```

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  world_state JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Entity Relationship Diagram

```
┌──────────┐     ┌────────────────┐     ┌──────────┐
│  users   │────<│ session_players│>────│ sessions │
│          │     │                │     │          │
│ id       │     │ session_id     │     │ id       │
│ username │     │ user_id        │     │ name     │
│ email    │     │ character_id   │     │ status   │
└──────┬───┘     └────────────────┘     │ max_plrs │
       │                                └────┬─────┘
       │                                     │
       │         ┌──────────────┐            │
       └────────<│  characters  │>───────────┘
                 │              │
                 │ id           │
                 │ name         │         ┌──────────┐
                 │ race/class   │    ┌───<│ game_log │
                 │ abilities    │    │    │          │
                 │ current_hp   │    │    │ id       │
                 │ equipment    │    │    │ session  │
                 └──────────────┘    │    │ type     │
                                     │    │ content  │
                 ┌──────────────┐    │    └──────────┘
                 │  sessions    │>───┘
                 │              │
                 │      ┌───────┘
                 │      ▼
                 │  ┌──────────┐
                 └─>│campaigns │
                    │          │
                    │ id       │
                    │ name     │
                    │ world    │
                    └──────────┘
```
