import { create } from 'zustand';
import { GameState, Character, GameSession, GameLogEntry } from '@/engine/types';

interface AuthState {
  token: string | null;
  userId: string | null;
  username: string | null;
}

interface GameStore {
  // Auth
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;

  // Session
  session: GameSession | null;
  setSession: (session: GameSession | null) => void;

  // Game state
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;

  // Character
  myCharacter: Character | null;
  setMyCharacter: (character: Character | null) => void;

  // UI
  narration: string[];
  addNarration: (text: string) => void;
  clearNarration: () => void;

  // Pending check
  pendingCheck: { skill: string; dc: number; player_id: string } | null;
  setPendingCheck: (check: { skill: string; dc: number; player_id: string } | null) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Auth
  auth: { token: null, userId: null, username: null },
  setAuth: (auth) => set({ auth }),
  clearAuth: () => set({ auth: { token: null, userId: null, username: null } }),

  // Session
  session: null,
  setSession: (session) => set({ session }),

  // Game state
  gameState: null,
  setGameState: (gameState) => set({ gameState }),

  // Character
  myCharacter: null,
  setMyCharacter: (myCharacter) => set({ myCharacter }),

  // UI
  narration: [],
  addNarration: (text) => set((state) => ({ narration: [...state.narration, text] })),
  clearNarration: () => set({ narration: [] }),

  // Pending check
  pendingCheck: null,
  setPendingCheck: (pendingCheck) => set({ pendingCheck }),

  // Loading
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  // Error
  error: null,
  setError: (error) => set({ error }),
}));
