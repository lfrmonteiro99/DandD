import { create } from 'zustand';
import { GameState, Character, GameSession } from '@/engine/types';

interface AuthState {
  token: string | null;
  userId: string | null;
  username: string | null;
}

interface GameStore {
  auth: AuthState;
  setAuth: (auth: AuthState) => void;

  session: GameSession | null;
  setSession: (session: GameSession | null) => void;

  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;

  myCharacter: Character | null;
  setMyCharacter: (character: Character | null) => void;

  narration: string[];
  addNarration: (text: string) => void;
  setNarration: (texts: string[]) => void;
  clearNarration: () => void;

  pendingCheck: { skill: string; dc: number; player_id: string } | null;
  setPendingCheck: (check: { skill: string; dc: number; player_id: string } | null) => void;

  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  error: string | null;
  setError: (error: string | null) => void;

  // Track which log entries have been rendered to avoid duplicates
  lastRenderedLogIndex: number;
  setLastRenderedLogIndex: (index: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  auth: { token: null, userId: null, username: null },
  setAuth: (auth) => set({ auth }),

  session: null,
  setSession: (session) => set({ session }),

  gameState: null,
  setGameState: (gameState) => set({ gameState }),

  myCharacter: null,
  setMyCharacter: (myCharacter) => set({ myCharacter }),

  narration: [],
  addNarration: (text) => set((state) => ({ narration: [...state.narration, text] })),
  setNarration: (texts) => set({ narration: texts }),
  clearNarration: () => set({ narration: [], lastRenderedLogIndex: -1 }),

  pendingCheck: null,
  setPendingCheck: (pendingCheck) => set({ pendingCheck }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

  error: null,
  setError: (error) => set({ error }),

  lastRenderedLogIndex: -1,
  setLastRenderedLogIndex: (index) => set({ lastRenderedLogIndex: index }),
}));
