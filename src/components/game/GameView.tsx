'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { HPBar } from '@/components/ui/HPBar';
import { CombatView } from '@/components/combat/CombatView';
import { useGameStore } from '@/store/game-store';
import * as api from '@/lib/api-client';

export function GameView({ sessionId }: { sessionId: string }) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const {
    gameState, setGameState, myCharacter, narration, addNarration,
    pendingCheck, setPendingCheck, lastRenderedLogIndex, setLastRenderedLogIndex,
  } = useGameStore();

  // Restore narration from game state log — runs when gameState changes
  // Uses lastRenderedLogIndex to avoid duplicating entries
  useEffect(() => {
    if (!gameState?.recent_log) return;
    const log = gameState.recent_log;

    if (log.length === 0) {
      // No log entries — show scene description if available
      if (narration.length === 0 && gameState.scene?.description) {
        addNarration(gameState.scene.description);
      }
      return;
    }

    // Only render entries we haven't seen before
    const startIndex = lastRenderedLogIndex + 1;
    if (startIndex >= log.length) return;

    const newEntries: string[] = [];
    for (let i = startIndex; i < log.length; i++) {
      const entry = log[i];
      if (entry.type === 'narration') {
        newEntries.push(entry.content);
      } else if (entry.type === 'player_action' && entry.actor_name) {
        newEntries.push(`**You:** ${entry.content.replace(entry.actor_name + ': ', '')}`);
      } else if (entry.type === 'dialogue') {
        newEntries.push(entry.content);
      } else if (entry.type === 'combat_action') {
        newEntries.push(entry.content);
      } else if (entry.type === 'system') {
        newEntries.push(`*${entry.content}*`);
      }
    }

    if (newEntries.length > 0) {
      for (const entry of newEntries) {
        addNarration(entry);
      }
      setLastRenderedLogIndex(log.length - 1);
    }
  }, [gameState?.recent_log?.length]);

  // Auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narration.length]);

  // Poll for state updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getGameState(sessionId);
        if (data.game_state) setGameState(data.game_state);
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, setGameState]);

  async function handleSendAction() {
    if (!inputText.trim() || loading) return;
    const text = inputText.trim();
    setInputText('');
    setLoading(true);

    addNarration(`**You:** ${text}`);

    try {
      const data = await api.sendAction(sessionId, 'free_text', text);
      if (data.narration) {
        addNarration(data.narration);
      }
      if (data.check_required) {
        setPendingCheck(data.check_required);
      }
      if (data.state) {
        setGameState(data.state);
        // Update the rendered index to avoid double-rendering from the log
        if (data.state.recent_log) {
          setLastRenderedLogIndex(data.state.recent_log.length - 1);
        }
      }
    } catch (err: any) {
      addNarration(`*Error: ${err.message}*`);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoll(skill: string, dc: number) {
    setLoading(true);
    setPendingCheck(null);
    try {
      const data = await api.sendRoll(sessionId, skill, dc);
      const resultText = data.success
        ? `**Skill Check:** ${skill} — Rolled ${data.total} vs DC ${dc} — **Success!**`
        : `**Skill Check:** ${skill} — Rolled ${data.total} vs DC ${dc} — **Failed.**`;
      addNarration(resultText);
      if (data.narration) addNarration(data.narration);
      if (data.state) {
        setGameState(data.state);
        if (data.state.recent_log) {
          setLastRenderedLogIndex(data.state.recent_log.length - 1);
        }
      }
    } catch (err: any) {
      addNarration(`*Error: ${err.message}*`);
    } finally {
      setLoading(false);
    }
  }

  if (!gameState) {
    return <div className="text-center text-gray-500 py-12">Loading game state...</div>;
  }

  // Combat mode
  if (gameState.phase === 'combat' && gameState.combat) {
    return (
      <CombatView
        sessionId={sessionId}
        gameState={gameState}
        character={myCharacter!}
        narration={narration}
        addNarration={addNarration}
        setGameState={setGameState}
      />
    );
  }

  const characters = Object.values(gameState.characters);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Main narrative panel */}
      <div className="flex-1 flex flex-col bg-gray-900/60 border border-gray-800 rounded-xl">
        {/* Scene header */}
        {gameState.scene && (
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/80">
            <h3 className="font-bold text-amber-400">{gameState.scene.name}</h3>
            <p className="text-sm text-gray-400">{gameState.scene.type}</p>
          </div>
        )}

        {/* Narration log */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {narration.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              {gameState.scene?.description || 'The adventure begins...'}
            </div>
          )}
          {narration.map((text, i) => (
            <div key={i} className="narration-enter">
              {text.startsWith('**You:') ? (
                <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-blue-200">
                  {text.replace(/\*\*/g, '')}
                </div>
              ) : text.startsWith('**Skill') ? (
                <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-3 text-purple-200 font-mono text-sm">
                  {text.replace(/\*\*/g, '')}
                </div>
              ) : text.startsWith('*Error') ? (
                <div className="text-red-400 text-sm italic">{text.replace(/\*/g, '')}</div>
              ) : text.startsWith('*') && text.endsWith('*') ? (
                <div className="text-gray-500 text-sm italic text-center">{text.replace(/\*/g, '')}</div>
              ) : (
                <div className="text-gray-200 leading-relaxed">
                  <span className="text-amber-500 font-bold mr-1">DM:</span>
                  {text}
                </div>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Pending skill check */}
        {pendingCheck && (
          <div className="px-6 py-3 border-t border-gray-800 bg-purple-900/10">
            <div className="flex items-center justify-between">
              <span className="text-purple-300">
                Roll <span className="font-bold capitalize">{pendingCheck.skill}</span> (DC {pendingCheck.dc})
              </span>
              <Button
                onClick={() => handleRoll(pendingCheck.skill, pendingCheck.dc)}
                loading={loading}
                size="sm"
              >
                Roll!
              </Button>
            </div>
          </div>
        )}

        {/* Action input */}
        <div className="px-6 py-4 border-t border-gray-800">
          <form onSubmit={(e) => { e.preventDefault(); handleSendAction(); }} className="flex gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500"
              placeholder="What do you do? (e.g., 'I search the room for hidden doors')"
              disabled={loading}
            />
            <Button type="submit" loading={loading} disabled={!inputText.trim()}>Send</Button>
          </form>
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setInputText('I look around')}>Look Around</Button>
            <Button variant="ghost" size="sm" onClick={() => setInputText('I search for traps')}>Search</Button>
            <Button variant="ghost" size="sm" onClick={() => setInputText('I take a short rest')}>Short Rest</Button>
          </div>
        </div>
      </div>

      {/* Sidebar — Party info */}
      <div className="w-72 space-y-4 hidden md:block">
        {/* Phase indicator */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase">Phase</div>
          <div className="text-amber-400 font-bold capitalize">{gameState.phase}</div>
        </div>

        {/* Party members */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase">Party</h3>
          {characters.map(char => (
            <div key={char.id} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-200 text-sm">{char.name}</span>
                <span className="text-xs text-gray-500">{char.race} {char.class}</span>
              </div>
              <HPBar current={char.current_hp} max={char.max_hp} size="sm" />
              {char.conditions.length > 0 && (
                <div className="flex gap-1">
                  {char.conditions.map(c => (
                    <span key={c} className="px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* My character quick stats */}
        {myCharacter && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-400 uppercase">My Stats</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="text-xs text-gray-500">AC</div><div className="font-bold text-amber-300">{myCharacter.armor_class}</div></div>
              <div><div className="text-xs text-gray-500">HP</div><div className="font-bold text-green-400">{myCharacter.current_hp}/{myCharacter.max_hp}</div></div>
              <div><div className="text-xs text-gray-500">Lvl</div><div className="font-bold text-blue-300">{myCharacter.level}</div></div>
            </div>
            {Object.keys(myCharacter.spell_slots).length > 0 && (
              <div>
                <div className="text-xs text-gray-500">Spell Slots</div>
                <div className="flex gap-1 mt-1">
                  {Object.entries(myCharacter.spell_slots).map(([lvl, slot]) => (
                    <span key={lvl} className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300">
                      Lv{lvl}: {slot.max - slot.used}/{slot.max}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scene exits */}
        {gameState.scene?.exits && gameState.scene.exits.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-400 uppercase">Exits</h3>
            {gameState.scene.exits.map((exit, i) => (
              <button
                key={i}
                onClick={() => setInputText(`I go ${exit.direction}`)}
                className="w-full text-left px-3 py-2 bg-gray-800/50 rounded-lg text-sm hover:bg-gray-700/50 transition-colors"
              >
                <span className="text-amber-400 font-medium capitalize">{exit.direction}</span>
                <span className="text-gray-500 ml-2 text-xs">{exit.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
