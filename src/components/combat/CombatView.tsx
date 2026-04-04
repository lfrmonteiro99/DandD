'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { HPBar } from '@/components/ui/HPBar';
import { Character, GameState, CombatState, Monster, Weapon } from '@/engine/types';
import { SPELLS } from '@/data/spells';
import * as api from '@/lib/api-client';

interface CombatViewProps {
  sessionId: string;
  gameState: GameState;
  character: Character;
  narration: string[];
  addNarration: (text: string) => void;
  setGameState: (state: GameState) => void;
}

export function CombatView({ sessionId, gameState, character, narration, addNarration, setGameState }: CombatViewProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSpells, setShowSpells] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const combat = gameState.combat!;
  const currentTurn = combat.initiative_order[combat.current_turn_index];
  const isMyTurn = currentTurn?.entity_id === character.id;
  const aliveMonsters = combat.monsters.filter(m => m.current_hp > 0);
  const aliveCharacters = Object.values(gameState.characters).filter(c => c.current_hp > 0);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narration]);

  async function handleCombatAction(actionType: string, targetId?: string, spellId?: string) {
    if (loading) return;
    setLoading(true);
    try {
      const data = await api.sendAction(sessionId, actionType, spellId, targetId || selectedTarget || undefined);
      if (data.state) setGameState(data.state);
      if (data.narration) addNarration(data.narration);

      // Add combat result narrations from the response
      setSelectedTarget(null);
    } catch (err: any) {
      addNarration(`*Error: ${err.message}*`);
    } finally {
      setLoading(false);
    }
  }

  const mySpells = character.known_spells
    .map(id => SPELLS[id])
    .filter(Boolean);

  const cantrips = mySpells.filter(s => s.level === 0);
  const levelSpells = mySpells.filter(s => s.level > 0);
  const hasSpellSlots = Object.values(character.spell_slots).some(s => s.used < s.max);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Combat Log */}
      <div className="flex-1 flex flex-col bg-gray-900/60 border border-gray-800 rounded-xl">
        {/* Combat header */}
        <div className="px-6 py-3 border-b border-gray-800 bg-red-900/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-red-400">COMBAT — Round {combat.round}</h3>
              <p className="text-sm text-gray-400">
                {isMyTurn ? "It's your turn!" : `Waiting for ${currentTurn?.entity_name}...`}
              </p>
            </div>
          </div>
        </div>

        {/* Initiative tracker */}
        <div className="px-6 py-2 border-b border-gray-800 flex gap-2 overflow-x-auto">
          {combat.initiative_order.map((entry, i) => {
            const isCurrent = i === combat.current_turn_index;
            const isPlayer = entry.entity_type === 'player';
            const char = isPlayer ? gameState.characters[entry.entity_id] : null;
            const monster = !isPlayer ? combat.monsters.find(m => m.id === entry.entity_id) : null;
            const isDead = (char && char.current_hp <= 0) || (monster && monster.current_hp <= 0);

            return (
              <div
                key={entry.entity_id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isDead ? 'bg-gray-800 text-gray-600 line-through' :
                  isCurrent ? 'bg-amber-700 text-white' :
                  isPlayer ? 'bg-blue-900/50 text-blue-300' :
                  'bg-red-900/50 text-red-300'
                }`}
              >
                {entry.entity_name}
                <span className="text-gray-400 ml-1">({entry.initiative_roll})</span>
              </div>
            );
          })}
        </div>

        {/* Combat narration */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {narration.map((text, i) => (
            <div key={i} className="narration-enter text-sm">
              {text.startsWith('*Error') ? (
                <span className="text-red-400 italic">{text.replace(/\*/g, '')}</span>
              ) : (
                <span className="text-gray-300">{text.replace(/\*\*/g, '')}</span>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Combat actions */}
        {isMyTurn && character.current_hp > 0 && (
          <div className="px-6 py-4 border-t border-gray-800 space-y-3">
            {/* Target selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Target:</span>
              {aliveMonsters.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedTarget(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedTarget === m.id
                      ? 'bg-red-800 text-red-100 border border-red-600'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-red-700'
                  }`}
                >
                  {m.name}
                  <span className="text-xs text-gray-400 ml-1">({m.current_hp}/{m.max_hp})</span>
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleCombatAction('attack')}
                loading={loading}
                disabled={!selectedTarget}
                size="sm"
              >
                Attack{character.weapons[0] ? ` (${character.weapons[0].name})` : ''}
              </Button>

              {cantrips.length > 0 && cantrips.map(spell => (
                <Button
                  key={spell.id}
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  disabled={spell.attack_roll && !selectedTarget}
                  onClick={() => handleCombatAction('cast_spell', selectedTarget || undefined, spell.id)}
                >
                  {spell.name}
                </Button>
              ))}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSpells(!showSpells)}
                disabled={levelSpells.length === 0}
              >
                Spells ({levelSpells.length})
              </Button>

              <Button variant="ghost" size="sm" loading={loading} onClick={() => handleCombatAction('dodge')}>
                Dodge
              </Button>
              <Button variant="ghost" size="sm" loading={loading} onClick={() => handleCombatAction('dash')}>
                Dash
              </Button>
            </div>

            {/* Spell list */}
            {showSpells && levelSpells.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
                {levelSpells.map(spell => {
                  const slot = character.spell_slots[spell.level];
                  const hasSlot = slot && slot.used < slot.max;
                  return (
                    <button
                      key={spell.id}
                      onClick={() => {
                        handleCombatAction('cast_spell', selectedTarget || undefined, spell.id);
                        setShowSpells(false);
                      }}
                      disabled={!hasSlot || loading}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
                    >
                      <div className="flex justify-between">
                        <span className="text-purple-300 font-medium">{spell.name}</span>
                        <span className="text-xs text-gray-500">Level {spell.level} {slot ? `(${slot.max - slot.used}/${slot.max})` : ''}</span>
                      </div>
                      <p className="text-xs text-gray-500">{spell.description.slice(0, 80)}...</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Combat sidebar */}
      <div className="w-72 space-y-4">
        {/* Monsters */}
        <div className="bg-gray-900/60 border border-red-900/30 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-red-400 uppercase">Enemies</h3>
          {combat.monsters.map(m => (
            <div key={m.id} className={m.current_hp <= 0 ? 'opacity-40' : ''}>
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-200 text-sm">
                  {m.name}
                  {m.current_hp <= 0 && ' (Dead)'}
                </span>
                <span className="text-xs text-gray-500">AC {m.ac}</span>
              </div>
              <HPBar current={m.current_hp} max={m.max_hp} size="sm" />
            </div>
          ))}
        </div>

        {/* Party */}
        <div className="bg-gray-900/60 border border-blue-900/30 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-blue-400 uppercase">Party</h3>
          {Object.values(gameState.characters).map(char => (
            <div key={char.id} className={char.current_hp <= 0 ? 'opacity-40' : ''}>
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-200 text-sm">
                  {char.name}
                  {char.id === character.id && ' (You)'}
                </span>
                <span className="text-xs text-gray-500">AC {char.armor_class}</span>
              </div>
              <HPBar current={char.current_hp} max={char.max_hp} size="sm" />
              {char.conditions.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {char.conditions.map(c => (
                    <span key={c} className="px-1.5 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* My character quick info */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div><div className="text-xs text-gray-500">AC</div><div className="font-bold text-amber-300">{character.armor_class}</div></div>
            <div><div className="text-xs text-gray-500">HP</div><div className="font-bold text-green-400">{character.current_hp}/{character.max_hp}</div></div>
            <div><div className="text-xs text-gray-500">Prof</div><div className="font-bold text-blue-300">+{character.proficiency_bonus}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
