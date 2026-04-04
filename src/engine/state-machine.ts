import { GamePhase, GameState, ActionType, Character, PlayerAction } from './types';

// ===========================
// State Transitions
// ===========================

interface Transition {
  from: GamePhase[];
  to: GamePhase;
  trigger: string;
}

const TRANSITIONS: Transition[] = [
  { from: ['lobby'], to: 'character_creation', trigger: 'game_start' },
  { from: ['character_creation'], to: 'exploration', trigger: 'all_characters_ready' },
  { from: ['exploration'], to: 'combat', trigger: 'combat_start' },
  { from: ['exploration'], to: 'social', trigger: 'social_start' },
  { from: ['exploration'], to: 'rest', trigger: 'rest_start' },
  { from: ['combat'], to: 'exploration', trigger: 'combat_end' },
  { from: ['social'], to: 'exploration', trigger: 'social_end' },
  { from: ['social'], to: 'combat', trigger: 'combat_start' },
  { from: ['rest'], to: 'exploration', trigger: 'rest_end' },
  { from: ['rest'], to: 'combat', trigger: 'combat_start' },
  { from: ['exploration', 'combat', 'social', 'rest'], to: 'paused', trigger: 'pause' },
  { from: ['paused'], to: 'exploration', trigger: 'resume_exploration' },
  { from: ['paused'], to: 'combat', trigger: 'resume_combat' },
];

export function canTransition(currentPhase: GamePhase, trigger: string): boolean {
  return TRANSITIONS.some(t => t.from.includes(currentPhase) && t.trigger === trigger);
}

export function transition(currentPhase: GamePhase, trigger: string): GamePhase | null {
  const t = TRANSITIONS.find(t => t.from.includes(currentPhase) && t.trigger === trigger);
  return t ? t.to : null;
}

// ===========================
// Available Actions per Phase
// ===========================

export function getAvailableActions(phase: GamePhase, isPlayerTurn: boolean = true): ActionType[] {
  switch (phase) {
    case 'exploration':
      return ['free_text', 'move', 'talk', 'use_item'];
    case 'combat':
      if (!isPlayerTurn) return [];
      return ['attack', 'cast_spell', 'dash', 'dodge', 'disengage', 'help', 'hide', 'use_item'];
    case 'social':
      return ['free_text', 'talk'];
    case 'rest':
      return ['use_item'];
    default:
      return [];
  }
}

// ===========================
// Action Validation
// ===========================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAction(
  state: GameState,
  action: PlayerAction
): ValidationResult {
  const character = state.characters[action.player_id];
  if (!character) {
    return { valid: false, error: 'Character not found' };
  }

  if (character.current_hp <= 0 && action.action_type !== 'free_text') {
    return { valid: false, error: 'Character is unconscious' };
  }

  const availableActions = getAvailableActions(state.phase, true);
  if (!availableActions.includes(action.action_type)) {
    return { valid: false, error: `Action '${action.action_type}' not available in ${state.phase} phase` };
  }

  // Combat-specific validation
  if (state.phase === 'combat' && state.combat) {
    const currentTurn = state.combat.initiative_order[state.combat.current_turn_index];
    if (currentTurn.entity_id !== action.player_id) {
      return { valid: false, error: 'Not your turn' };
    }
  }

  // Spell slot validation
  if (action.action_type === 'cast_spell' && action.details?.spell_level) {
    const level = action.details.spell_level as number;
    if (level > 0) {
      const slot = character.spell_slots[level];
      if (!slot || slot.used >= slot.max) {
        return { valid: false, error: `No spell slots remaining at level ${level}` };
      }
    }
  }

  // Target validation for attacks
  if (action.action_type === 'attack' && state.combat) {
    if (!action.target_id) {
      return { valid: false, error: 'Attack requires a target' };
    }
    const target = state.combat.monsters.find(m => m.id === action.target_id);
    if (!target || target.current_hp <= 0) {
      return { valid: false, error: 'Invalid target' };
    }
  }

  return { valid: true };
}

// ===========================
// Game State Helpers
// ===========================

export function createInitialGameState(sessionId: string): GameState {
  return {
    session_id: sessionId,
    phase: 'lobby',
    scene: null,
    combat: null,
    characters: {},
    npcs: {},
    recent_log: [],
    round_number: 0,
  };
}

export function addLogEntry(state: GameState, entry: Omit<GameState['recent_log'][0], 'id' | 'session_id' | 'timestamp'>): GameState {
  const logEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    session_id: state.session_id,
    timestamp: Date.now(),
  };
  return {
    ...state,
    recent_log: [...state.recent_log.slice(-49), logEntry], // Keep last 50
  };
}
