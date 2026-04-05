'use client';

import { useState, useEffect } from 'react';
import { AuthForm } from '@/components/lobby/AuthForm';
import { SessionLobby } from '@/components/lobby/SessionLobby';
import { CharacterCreation } from '@/components/character/CharacterCreation';
import { GameView } from '@/components/game/GameView';
import { Button } from '@/components/ui/Button';
import { HowToPlay } from '@/components/ui/HowToPlay';
import { useGameStore } from '@/store/game-store';
import * as api from '@/lib/api-client';

export default function Home() {
  const {
    auth, setAuth, session, setSession, setGameState,
    myCharacter, setMyCharacter, gameState, addNarration,
    clearNarration,
  } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionView, setSessionView] = useState<'lobby' | 'character' | 'waiting' | 'game'>('lobby');

  // Check for existing auth
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe().then(data => {
        setAuth({ token, userId: data.user_id, username: data.username });
      }).catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, [setAuth]);

  // Auto-reconnect to saved session on page load
  useEffect(() => {
    if (!auth.userId || session) return;
    const savedSessionId = localStorage.getItem('session_id');
    if (!savedSessionId) return;

    api.getGameState(savedSessionId).then(data => {
      if (data.session && data.game_state) {
        // Set BOTH session and gameState together to avoid race
        setGameState(data.game_state);
        setSession(data.session);

        // Find our character
        for (const char of Object.values(data.game_state.characters || {}) as any[]) {
          if (char.user_id === auth.userId) {
            setMyCharacter(char);
            break;
          }
        }
      } else if (data.session) {
        setSession(data.session);
      }
    }).catch(() => {
      localStorage.removeItem('session_id');
    });
  }, [auth.userId, session, setSession, setGameState, setMyCharacter]);

  // Save session ID to localStorage
  useEffect(() => {
    if (session) {
      localStorage.setItem('session_id', session.id);
    } else {
      localStorage.removeItem('session_id');
    }
  }, [session]);

  // Determine view
  useEffect(() => {
    if (!session) {
      setSessionView('lobby');
    } else if (session.status === 'in_progress' && gameState && gameState.phase !== 'lobby' && gameState.phase !== 'character_creation') {
      setSessionView('game');
    } else if (!myCharacter) {
      const player = session.players.find(p => p.user_id === auth.userId);
      if (player?.character_id) {
        setSessionView('waiting'); // Character exists on server, loading
      } else {
        setSessionView('character');
      }
    } else {
      setSessionView('waiting');
    }
  }, [session, myCharacter, gameState, auth.userId]);

  function handleLeave() {
    setSession(null);
    setGameState(null);
    setMyCharacter(null);
    clearNarration();
  }

  function handleLogout() {
    setAuth({ token: null, userId: null, username: null });
    localStorage.removeItem('token');
    handleLeave();
  }

  async function handleStartGame() {
    if (!session) return;
    setLoading(true);
    setStartError(null);
    try {
      const data = await api.startGame(session.id);
      setGameState(data.state);
      if (data.narration) addNarration(data.narration);
      setSession({ ...session, status: 'in_progress' });
    } catch (err: any) {
      setStartError(err.message || 'Failed to start the adventure. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Not authenticated
  if (!auth.token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-amber-400 mb-3">D&D Arena</h1>
          <p className="text-xl text-gray-400">Browser-Based Dungeons & Dragons with AI Dungeon Master</p>
          <div className="flex justify-center gap-3 mt-4">
            <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">4 Classes</span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">4 Races</span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">AI DM</span>
            <span className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">Real-time</span>
          </div>
        </div>
        <AuthForm />
        <HowToPlay />
      </div>
    );
  }

  // In game
  if (sessionView === 'game' && session && gameState) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-4">
            <h1 className="text-amber-400 font-bold">D&D Arena</h1>
            <span className="text-gray-500">|</span>
            <span className="text-gray-300">{session.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{auth.username}</span>
            <Button variant="ghost" size="sm" onClick={handleLeave}>Leave</Button>
          </div>
        </div>
        <GameView sessionId={session.id} />
        <HowToPlay />
      </div>
    );
  }

  const readyPlayers = session?.players.filter(p => p.character_id).length || 0;
  const canStart = readyPlayers >= 1;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800 bg-gray-900/80">
        <h1 className="text-amber-400 font-bold text-xl">D&D Arena</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{auth.username}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        {sessionView === 'lobby' && <SessionLobby />}

        {sessionView === 'character' && session && (
          <CharacterCreation sessionId={session.id} />
        )}

        {sessionView === 'waiting' && session && (
          <div className="max-w-lg mx-auto text-center space-y-6">
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-amber-400 mb-4">{session.name}</h2>

              {myCharacter && (
                <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-bold text-gray-200">{myCharacter.name}</h3>
                  <p className="text-sm text-gray-400">
                    Level {myCharacter.level} {myCharacter.race} {myCharacter.class}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    HP: {myCharacter.max_hp} | AC: {myCharacter.armor_class}
                  </p>
                </div>
              )}

              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase">Players ({readyPlayers}/{session.max_players})</h3>
                {session.players.map(p => (
                  <div key={p.user_id} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg">
                    <span className="text-gray-200">{p.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      p.character_id ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-500'
                    }`}>
                      {p.character_id ? 'Ready' : 'Creating character...'}
                    </span>
                  </div>
                ))}
                {readyPlayers < session.max_players && (
                  <p className="text-xs text-gray-600 mt-2">
                    Empty slots will be filled with AI companions
                  </p>
                )}
              </div>

              {session.created_by === auth.userId && (
                <div className="space-y-3">
                  <Button
                    onClick={handleStartGame}
                    loading={loading}
                    disabled={!canStart}
                    className="w-full"
                    size="lg"
                  >
                    {loading
                      ? 'Generating adventure world...'
                      : `Start Adventure ${readyPlayers < session.max_players ? `(${readyPlayers} player${readyPlayers > 1 ? 's' : ''} + AI companions)` : ''}`}
                  </Button>
                  {loading && (
                    <p className="text-sm text-gray-500 animate-pulse">
                      The AI Dungeon Master is crafting your opening scene. This may take up to 30 seconds...
                    </p>
                  )}
                  {startError && (
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-400">
                      {startError}
                    </div>
                  )}
                </div>
              )}

              {session.created_by !== auth.userId && (
                <p className="text-gray-500 text-sm">Waiting for the host to start the game...</p>
              )}
            </div>

            <Button variant="ghost" onClick={handleLeave}>Leave Session</Button>
          </div>
        )}
      </div>
      <HowToPlay />
    </div>
  );
}
