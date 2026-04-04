import { GameState, Character, CombatState, GameLogEntry, Scene, NPC } from '../engine/types';

export function buildSceneContext(scene: Scene | null): string {
  if (!scene) return 'No scene set.';
  return `${scene.name}: ${scene.description} [Type: ${scene.type}] Exits: ${scene.exits.map(e => `${e.direction} (${e.description})`).join(', ')}`;
}

export function buildCharacterSummary(characters: Record<string, Character>): string {
  return Object.values(characters).map(c =>
    `${c.name} (Level ${c.level} ${c.race} ${c.class}, HP: ${c.current_hp}/${c.max_hp}, AC: ${c.armor_class})`
  ).join('; ');
}

export function buildPartyDescription(characters: Record<string, Character>): string {
  return Object.values(characters).map(c => {
    const mainStat = {
      fighter: 'STR',
      wizard: 'INT',
      rogue: 'DEX',
      cleric: 'WIS',
    }[c.class];
    return `${c.name}: Level ${c.level} ${c.race} ${c.class} (${mainStat}-focused, HP: ${c.current_hp}/${c.max_hp})`;
  }).join('\n');
}

export function buildRecentLog(log: GameLogEntry[], limit: number = 10): string {
  return log.slice(-limit).map(entry => {
    const prefix = entry.actor_name ? `[${entry.actor_name}]` : '[System]';
    return `${prefix} ${entry.content}`;
  }).join('\n');
}

export function buildCombatContext(combat: CombatState | null, characters: Record<string, Character>): string {
  if (!combat) return 'Not in combat.';

  const turnOrder = combat.initiative_order.map((e, i) => {
    const marker = i === combat.current_turn_index ? '→ ' : '  ';
    if (e.entity_type === 'player') {
      const char = characters[e.entity_id];
      return `${marker}${e.entity_name} (Player, HP: ${char?.current_hp}/${char?.max_hp}, Init: ${e.initiative_roll})`;
    }
    const monster = combat.monsters.find(m => m.id === e.entity_id);
    return `${marker}${e.entity_name} (Monster, HP: ${monster?.current_hp}/${monster?.max_hp}, Init: ${e.initiative_roll})`;
  }).join('\n');

  const monstersAlive = combat.monsters.filter(m => m.current_hp > 0);
  const monsterDetails = monstersAlive.map(m =>
    `${m.name}: HP ${m.current_hp}/${m.max_hp}, AC ${m.ac}, Attacks: ${m.attacks.map(a => a.name).join(', ')}`
  ).join('\n');

  return `Round ${combat.round}\nInitiative Order:\n${turnOrder}\n\nMonsters:\n${monsterDetails}`;
}

export function buildNPCContext(npc: NPC): string {
  return `${npc.name}: ${npc.description}. Personality: ${npc.personality}. Disposition: ${npc.disposition}. Recent dialogue: ${npc.dialogue_history.slice(-5).join(' | ') || 'None'}`;
}

export function buildMonsterTurnContext(
  combat: CombatState,
  monsterId: string,
  characters: Record<string, Character>
): { monster: string; targets: string } {
  const monster = combat.monsters.find(m => m.id === monsterId);
  if (!monster) return { monster: 'Unknown', targets: '' };

  const monsterStr = `${monster.name} (HP: ${monster.current_hp}/${monster.max_hp}, AC: ${monster.ac}, Attacks: ${monster.attacks.map(a => `${a.name} (+${a.attack_bonus}, ${a.damage_dice} ${a.damage_type})`).join(', ')})`;

  const targets = Object.values(characters)
    .filter(c => c.current_hp > 0)
    .map(c => `${c.name} [id: ${c.id}] (HP: ${c.current_hp}/${c.max_hp}, AC: ${c.armor_class})`)
    .join('\n');

  return { monster: monsterStr, targets };
}

/** Fill template placeholders {key} with values */
export function fillTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
