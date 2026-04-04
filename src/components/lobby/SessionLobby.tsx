'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/store/game-store';
import * as api from '@/lib/api-client';

interface SessionInfo {
  id: string;
  name: string;
  status: string;
  player_count: number;
  max_players: number;
}

export function SessionLobby() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { auth, setSession, setMyCharacter, setGameState, addNarration } = useGameStore();

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const data = await api.listSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.createSession(newSessionName.trim());
      setSession(data.session);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(sessionId: string) {
    setLoading(true);
    setError('');
    try {
      // Actually join the session
      const joinData = await api.joinSession(sessionId);
      const session = joinData.session;
      setSession(session);

      // Check if we already have a character in this session
      try {
        const stateData = await api.getGameState(sessionId);
        if (stateData.game_state) {
          setGameState(stateData.game_state);
          // Find our character
          const characters = stateData.game_state.characters || {};
          for (const char of Object.values(characters) as any[]) {
            if (char.user_id === auth.userId) {
              setMyCharacter(char);
              break;
            }
          }
          // If game is already in progress, load narration
          if (stateData.game_state.phase !== 'lobby' && stateData.game_state.recent_log) {
            for (const entry of stateData.game_state.recent_log) {
              if (entry.type === 'narration') addNarration(entry.content);
            }
          }
        }
        // Update session with latest data
        if (stateData.session) setSession(stateData.session);
      } catch {
        // Game state might not exist yet, that's fine
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-400">Game Sessions</h2>
        <div className="flex gap-2">
          <Button onClick={() => loadSessions()} variant="ghost" size="sm">Refresh</Button>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm">
            {showCreate ? 'Cancel' : 'New Session'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="Session name (e.g., 'Quest for the Lost Crown')"
              required
            />
            <Button type="submit" loading={loading}>Create</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-lg">No active sessions.</p>
            <p className="text-gray-600 text-sm mt-1">Create a new session to begin your adventure!</p>
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-gray-100">{session.name}</h3>
                <p className="text-sm text-gray-500">
                  {session.player_count}/{session.max_players} players
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    session.status === 'lobby' ? 'bg-green-900/50 text-green-400' :
                    session.status === 'in_progress' ? 'bg-amber-900/50 text-amber-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {session.status}
                  </span>
                </p>
              </div>
              <Button
                onClick={() => handleJoin(session.id)}
                variant={session.status === 'lobby' ? 'primary' : 'secondary'}
                size="sm"
                loading={loading}
              >
                {session.status === 'lobby' ? 'Join' : 'Reconnect'}
              </Button>
            </div>
          ))
        )}
      </div>

      <p className="text-center text-gray-600 text-sm">
        Logged in as <span className="text-gray-400">{auth.username}</span>
      </p>
    </div>
  );
}
