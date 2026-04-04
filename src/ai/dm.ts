import { GoogleGenerativeAI } from '@google/generative-ai';
import { GameState, DMResponse, MonsterActionDecision, NPC, Scene } from '../engine/types';
import {
  SYSTEM_PROMPT, NARRATION_PROMPT, COMBAT_NARRATION_PROMPT,
  MONSTER_ACTION_PROMPT, NPC_DIALOGUE_PROMPT, SCENE_GENERATION_PROMPT,
  ADVENTURE_START_PROMPT,
} from './prompts';
import {
  buildSceneContext, buildCharacterSummary, buildRecentLog,
  buildCombatContext, buildNPCContext, buildMonsterTurnContext,
  buildPartyDescription, fillTemplate,
} from './context-builder';

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

async function callAI(userMessage: string): Promise<string> {
  try {
    const model = getGenAI().getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent(userMessage);
    return result.response.text() || '{}';
  } catch (error) {
    console.error('Gemini API error:', error);
    return '{}';
  }
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    // Extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    return JSON.parse(jsonMatch[1] || text);
  } catch {
    console.error('Failed to parse AI response:', text.slice(0, 200));
    return fallback;
  }
}

// ===========================
// AI DM Functions
// ===========================

export async function generateNarration(
  state: GameState,
  playerAction: string,
  playerName: string
): Promise<DMResponse> {
  const prompt = fillTemplate(NARRATION_PROMPT, {
    scene: buildSceneContext(state.scene),
    recent_log: buildRecentLog(state.recent_log),
    action: `${playerName}: ${playerAction}`,
    characters: buildCharacterSummary(state.characters),
  });

  const response = await callAI(prompt);
  return parseJSON<DMResponse>(response, {
    narration: `${playerName} attempts to ${playerAction}. The result is uncertain...`,
    dm_decisions: {},
    mood: 'neutral',
  });
}

export async function generateCombatNarration(
  round: number,
  attackerName: string,
  targetName: string,
  action: string,
  result: string
): Promise<string> {
  const prompt = fillTemplate(COMBAT_NARRATION_PROMPT, {
    round: round.toString(),
    attacker: attackerName,
    target: targetName,
    action,
    result,
  });

  const response = await callAI(prompt);
  const parsed = parseJSON<{ narration: string }>(response, { narration: '' });
  return parsed.narration || `${attackerName} ${action} ${targetName}. ${result}`;
}

export async function decideMonsterAction(
  state: GameState,
  monsterId: string
): Promise<MonsterActionDecision> {
  if (!state.combat) {
    return { monster_id: monsterId, action: 'attack', target_id: '' };
  }

  const { monster, targets } = buildMonsterTurnContext(
    state.combat, monsterId, state.characters
  );

  const monsterData = state.combat.monsters.find(m => m.id === monsterId);

  const prompt = fillTemplate(MONSTER_ACTION_PROMPT, {
    round: state.combat.round.toString(),
    monster,
    monster_id: monsterId,
    monster_hp: monsterData?.current_hp.toString() || '?',
    monster_max_hp: monsterData?.max_hp.toString() || '?',
    attacks: monsterData?.attacks.map(a => `${a.name} (+${a.attack_bonus}, ${a.damage_dice})`).join(', ') || 'Unknown',
    targets,
  });

  const response = await callAI(prompt);
  const decision = parseJSON<MonsterActionDecision>(response, {
    monster_id: monsterId,
    action: 'attack',
    target_id: Object.keys(state.characters)[0] || '',
    attack_name: monsterData?.attacks[0]?.name,
  });

  // Validate target exists and is alive
  const targetChar = decision.target_id ? state.characters[decision.target_id] : undefined;
  if (!targetChar || targetChar.current_hp <= 0) {
    const alivePlayers = Object.values(state.characters).filter(c => c.current_hp > 0);
    if (alivePlayers.length > 0) {
      decision.target_id = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
    }
  }

  return decision;
}

export async function generateNPCDialogue(
  npc: NPC,
  playerText: string,
  sceneContext: string
): Promise<{ dialogue: string; disposition_change?: string; check_required?: { skill: string; dc: number } }> {
  const prompt = fillTemplate(NPC_DIALOGUE_PROMPT, {
    npc_name: npc.name,
    npc_personality: npc.personality,
    npc_disposition: npc.disposition,
    scene_context: sceneContext,
    player_text: playerText,
    dialogue_history: npc.dialogue_history.slice(-5).join('\n') || 'None',
  });

  const response = await callAI(prompt);
  return parseJSON(response, {
    dialogue: `${npc.name} regards you thoughtfully but says nothing.`,
  });
}

export async function generateStartingScene(
  state: GameState
): Promise<{ scene: Scene; narration: string; mood: string }> {
  const prompt = fillTemplate(ADVENTURE_START_PROMPT, {
    party_description: buildPartyDescription(state.characters),
  });

  const response = await callAI(prompt);
  const parsed = parseJSON(response, {
    scene: {
      name: 'The Rusty Tankard Tavern',
      description: 'A dimly lit tavern with the smell of ale and roasted meat. A crackling fire warms the common room where a few patrons sit nursing their drinks.',
      type: 'interior' as const,
      npcs: [{
        name: 'Greta the Innkeeper',
        description: 'A stout human woman with kind eyes and flour-dusted apron',
        disposition: 'friendly' as const,
        personality: 'warm, gossipy, helpful',
      }],
      exits: [
        { direction: 'outside', description: 'The tavern door leads to the town square' },
        { direction: 'upstairs', description: 'Wooden stairs lead to the guest rooms' },
      ],
    },
    narration: 'You find yourselves gathered in a dimly lit tavern, drawn together by rumor of adventure. The innkeeper approaches with a knowing smile...',
    mood: 'atmospheric',
  });

  const scene: Scene = {
    id: 'scene_' + Date.now(),
    name: parsed.scene.name,
    description: parsed.scene.description,
    type: parsed.scene.type as Scene['type'],
    npcs: (parsed.scene.npcs || []).map((npc: any) => ({
      id: 'npc_' + Math.random().toString(36).slice(2, 8),
      name: npc.name,
      description: npc.description,
      disposition: npc.disposition || 'neutral',
      personality: npc.personality || 'reserved',
      dialogue_history: [],
    })),
    monsters_present: [],
    exits: parsed.scene.exits || [],
  };

  return {
    scene,
    narration: parsed.narration,
    mood: parsed.mood || 'atmospheric',
  };
}

export async function generateScene(
  state: GameState,
  trigger: string
): Promise<{ scene: Scene; narration: string; mood: string }> {
  const prompt = fillTemplate(SCENE_GENERATION_PROMPT, {
    adventure_context: buildRecentLog(state.recent_log, 20),
    party: buildCharacterSummary(state.characters),
    level: '1',
    previous_scene: buildSceneContext(state.scene),
    trigger,
  });

  const response = await callAI(prompt);
  const parsed = parseJSON(response, {
    scene: {
      name: 'Unknown Area',
      description: 'You enter a new area.',
      type: 'wilderness' as const,
      npcs: [] as any[],
      exits: [{ direction: 'back', description: 'The way you came' }],
    },
    narration: 'You move forward into uncharted territory...',
    mood: 'mysterious',
  });

  const scene: Scene = {
    id: 'scene_' + Date.now(),
    name: parsed.scene.name,
    description: parsed.scene.description,
    type: parsed.scene.type as Scene['type'],
    npcs: (parsed.scene.npcs || []).map((npc: any) => ({
      id: 'npc_' + Math.random().toString(36).slice(2, 8),
      name: npc.name,
      description: npc.description || '',
      disposition: npc.disposition || 'neutral',
      personality: npc.personality || 'reserved',
      dialogue_history: [],
    })),
    monsters_present: [],
    exits: parsed.scene.exits || [],
  };

  return { scene, narration: parsed.narration, mood: parsed.mood || 'mysterious' };
}
