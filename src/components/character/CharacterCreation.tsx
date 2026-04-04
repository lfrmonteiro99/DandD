'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/store/game-store';
import * as api from '@/lib/api-client';
import { CLASSES } from '@/data/classes';
import { RACES } from '@/data/races';
import { Race, CharacterClass, Ability, AbilityScores } from '@/engine/types';
import { calculateModifier } from '@/engine/character';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES: Ability[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const ABILITY_LABELS: Record<Ability, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
};

export function CharacterCreation({ sessionId }: { sessionId: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [race, setRace] = useState<Race | null>(null);
  const [charClass, setCharClass] = useState<CharacterClass | null>(null);
  const [scores, setScores] = useState<Record<Ability, number | null>>({
    strength: null, dexterity: null, constitution: null,
    intelligence: null, wisdom: null, charisma: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setMyCharacter } = useGameStore();

  const usedScores = Object.values(scores).filter(v => v !== null) as number[];
  const availableScores = STANDARD_ARRAY.filter(s => {
    const usedCount = usedScores.filter(u => u === s).length;
    const totalCount = STANDARD_ARRAY.filter(t => t === s).length;
    return usedCount < totalCount;
  });

  function assignScore(ability: Ability, score: number) {
    setScores(prev => {
      const updated = { ...prev };
      // If this ability already has a score, free it
      updated[ability] = score;
      return updated;
    });
  }

  function clearScore(ability: Ability) {
    setScores(prev => ({ ...prev, [ability]: null }));
  }

  const allScoresAssigned = Object.values(scores).every(v => v !== null);

  async function handleSubmit() {
    if (!name || !race || !charClass || !allScoresAssigned) return;
    setLoading(true);
    setError('');

    try {
      const abilities: Record<string, number> = {};
      for (const [key, val] of Object.entries(scores)) {
        abilities[key] = val as number;
      }
      const data = await api.createCharacter({
        session_id: sessionId,
        name,
        race,
        character_class: charClass,
        abilities,
      });
      setMyCharacter(data.character);
    } catch (err: any) {
      setError(err.message || 'Failed to create character');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-8 backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-amber-400 mb-6 text-center">Create Your Character</h2>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {['Race', 'Class', 'Abilities', 'Name'].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                i === step
                  ? 'bg-amber-700 text-white'
                  : i < step
                    ? 'bg-amber-900/50 text-amber-400'
                    : 'bg-gray-800 text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Step 0: Race */}
        {step === 0 && (
          <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-sm text-blue-200">
            <strong>New to D&D?</strong> Your race gives stat bonuses and special traits. <strong>Human</strong> is the simplest choice — bonus to everything. <strong>Elf</strong> and <strong>Halfling</strong> are great for Rogues (DEX bonus). <strong>Dwarf</strong> is perfect for Fighters and Clerics (CON bonus = more HP).
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(Object.entries(RACES) as [Race, typeof RACES[Race]][]).map(([id, r]) => (
              <button
                key={id}
                onClick={() => { setRace(id); setStep(1); }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  race === id
                    ? 'border-amber-500 bg-amber-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <h3 className="font-bold text-lg text-gray-100">{r.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{r.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(r.ability_bonuses).map(([ab, bonus]) => (
                    <span key={ab} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-amber-300">
                      +{bonus} {ABILITY_LABELS[ab as Ability]}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  {r.traits.map(t => (
                    <span key={t.name} className="text-xs text-gray-500 block">{t.name}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          </div>
        )}

        {/* Step 1: Class */}
        {step === 1 && (
          <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-sm text-blue-200">
            <strong>New to D&D?</strong> Your class determines your combat role. <strong>Fighter</strong> is the easiest to play — just attack! <strong>Cleric</strong> heals and fights. <strong>Rogue</strong> deals burst damage via Sneak Attack. <strong>Wizard</strong> has powerful spells but is fragile.
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(Object.entries(CLASSES) as [CharacterClass, typeof CLASSES[CharacterClass]][]).map(([id, c]) => (
              <button
                key={id}
                onClick={() => { setCharClass(id); setStep(2); }}
                className={`p-4 rounded-xl border text-left transition-all ${
                  charClass === id
                    ? 'border-amber-500 bg-amber-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <h3 className="font-bold text-lg text-gray-100">{c.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{c.description}</p>
                <div className="mt-2 flex gap-2">
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-red-300">Hit Die: {c.hit_die}</span>
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-blue-300">Primary: {ABILITY_LABELS[c.primary_ability]}</span>
                </div>
                <div className="mt-2">
                  {c.features.slice(0, 2).map(f => (
                    <span key={f.name} className="text-xs text-gray-500 block">{f.name}: {f.description.slice(0, 60)}...</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          </div>
        )}

        {/* Step 2: Ability Scores */}
        {step === 2 && (
          <div className="space-y-6">
            {charClass && (
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-3 text-sm text-blue-200">
                <strong>Tip:</strong>{' '}
                {charClass === 'fighter' && 'Put your 15 in Strength (or Dexterity for a ranged fighter), and your 14 in Constitution for more HP.'}
                {charClass === 'wizard' && 'Put your 15 in Intelligence (your spellcasting stat), and 14 in Dexterity or Constitution to survive.'}
                {charClass === 'rogue' && 'Put your 15 in Dexterity (used for attacks, AC, stealth, and initiative), and 14 in Constitution.'}
                {charClass === 'cleric' && 'Put your 15 in Wisdom (your spellcasting stat), and 14 in Constitution or Strength.'}
              </div>
            )}
            <p className="text-gray-400 text-center">
              Assign the Standard Array values to your abilities. Click a value, then click an ability.
            </p>

            {/* Available scores */}
            <div className="flex justify-center gap-2">
              {STANDARD_ARRAY.map((score, i) => {
                const isUsed = usedScores.includes(score) &&
                  usedScores.filter(u => u === score).length > STANDARD_ARRAY.slice(0, i).filter(s => s === score).length;
                return (
                  <span
                    key={`${score}-${i}`}
                    className={`w-12 h-12 flex items-center justify-center rounded-lg font-bold text-lg ${
                      usedScores.filter(u => u === score).length >= STANDARD_ARRAY.filter(s => s === score).length
                        ? 'bg-gray-800 text-gray-600'
                        : 'bg-amber-900/50 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {score}
                  </span>
                );
              })}
            </div>

            {/* Ability slots */}
            <div className="grid grid-cols-3 gap-4">
              {ABILITIES.map(ability => {
                const assigned = scores[ability];
                const racialBonus = race ? (RACES[race].ability_bonuses[ability] || 0) : 0;
                const total = assigned !== null ? assigned + racialBonus : null;
                const mod = total !== null ? calculateModifier(total) : null;

                return (
                  <div key={ability} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase mb-1">{ability}</div>
                    <div className="flex items-center justify-between">
                      {assigned !== null ? (
                        <button
                          onClick={() => clearScore(ability)}
                          className="text-2xl font-bold text-amber-300 hover:text-red-400 transition-colors"
                          title="Click to unassign"
                        >
                          {total}
                          {racialBonus > 0 && <span className="text-xs text-green-400 ml-1">(+{racialBonus})</span>}
                        </button>
                      ) : (
                        <div className="flex gap-1 flex-wrap">
                          {availableScores.filter((v, i, a) => a.indexOf(v) === i).map(score => (
                            <button
                              key={score}
                              onClick={() => assignScore(ability, score)}
                              className="w-8 h-8 bg-gray-700 hover:bg-amber-800 rounded text-sm font-bold transition-colors"
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      )}
                      {mod !== null && (
                        <span className={`text-sm font-mono ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {mod >= 0 ? '+' : ''}{mod}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!allScoresAssigned}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Name */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <label className="block text-gray-400 mb-2">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-md mx-auto block px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-xl text-center focus:outline-none focus:border-amber-500"
                placeholder="Enter your character's name..."
                required
              />
            </div>

            {/* Character summary */}
            {race && charClass && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-amber-400 mb-3">
                  {name || '???'} — {RACES[race].name} {CLASSES[charClass].name}
                </h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {ABILITIES.map(ab => {
                    const base = scores[ab] || 0;
                    const bonus = RACES[race].ability_bonuses[ab] || 0;
                    const total = base + bonus;
                    const mod = calculateModifier(total);
                    return (
                      <div key={ab} className="text-center">
                        <div className="text-xs text-gray-500 uppercase">{ABILITY_LABELS[ab]}</div>
                        <div className="text-lg font-bold text-gray-200">{total}</div>
                        <div className={`text-xs ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({mod >= 0 ? '+' : ''}{mod})
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <p>Hit Die: {CLASSES[charClass].hit_die} | Speed: {RACES[race].speed} ft</p>
                  <p>Saves: {CLASSES[charClass].saving_throw_proficiencies.map(s => ABILITY_LABELS[s]).join(', ')}</p>
                  <p>Skills: {CLASSES[charClass].skill_proficiencies.join(', ')}</p>
                </div>
              </div>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} loading={loading} disabled={!name.trim()}>
                Create Character
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
