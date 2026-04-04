# Game Loop & State Machine

## 1. Game Phase State Machine

```
                    ┌─────────────┐
                    │   LOBBY     │
                    │             │
                    │ Players join│
                    │ Create chars│
                    └──────┬──────┘
                           │ All players ready
                           ▼
                ┌──────────────────────┐
                │  CHARACTER_CREATION  │
                │                      │
                │  Race/Class select   │
                │  Stat assignment     │
                │  Equipment select    │
                └──────────┬───────────┘
                           │ All characters created
                           ▼
          ┌────────────────────────────────────┐
          │            EXPLORATION              │
          │                                     │
          │  AI DM describes scene              │
          │  Players explore, investigate       │◄──────────┐
          │  Skill checks as needed             │           │
          └────┬──────────────┬─────────┬──────┘           │
               │              │         │                   │
    Hostile    │    NPC       │  Rest   │    Combat ends    │
    encounter  │  interaction │ declared│                   │
               ▼              ▼         ▼                   │
          ┌─────────┐  ┌──────────┐  ┌──────────┐         │
          │ COMBAT  │  │  SOCIAL  │  │   REST   │         │
          │         │  │          │  │          │         │
          │ Init    │  │ Dialogue │  │ Short or │         │
          │ Turns   │  │ Checks   │  │ Long rest│         │
          │ Resolve │  │ Roleplay │  │ Recovery │         │
          └────┬────┘  └────┬─────┘  └────┬─────┘         │
               │            │              │                │
               └────────────┴──────────────┘────────────────┘
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| LOBBY | CHARACTER_CREATION | Host starts game, all players joined |
| CHARACTER_CREATION | EXPLORATION | All characters submitted and validated |
| EXPLORATION | COMBAT | Hostile encounter (AI decision or scripted) |
| EXPLORATION | SOCIAL | NPC interaction initiated |
| EXPLORATION | REST | Player(s) declare rest |
| COMBAT | EXPLORATION | All enemies defeated/fled/surrendered |
| SOCIAL | EXPLORATION | Conversation ends (AI decides or player leaves) |
| SOCIAL | COMBAT | NPC turns hostile |
| REST | EXPLORATION | Rest period completes |
| Any | PAUSED | Host pauses game |
| PAUSED | (previous) | Host resumes |

---

## 2. Core Game Loop (Tick-Based)

The server processes the game in discrete "ticks" — each tick processes one player action and its consequences.

```
┌─────────────────────────────────────────────────┐
│                 GAME LOOP                        │
│                                                  │
│  1. AWAIT INPUT                                  │
│     └─ Wait for player action via WebSocket      │
│                                                  │
│  2. VALIDATE                                     │
│     └─ Rules Engine checks if action is legal    │
│     └─ Is it this player's turn? (combat)        │
│     └─ Does player have resources? (spell slots) │
│                                                  │
│  3. RESOLVE                                      │
│     └─ Dice rolls (if needed)                    │
│     └─ Apply mechanical effects                  │
│     └─ Update game state                         │
│                                                  │
│  4. AI NARRATE                                   │
│     └─ Send context to Claude                    │
│     └─ Receive narration + DM decisions          │
│     └─ Validate AI decisions against rules       │
│                                                  │
│  5. BROADCAST                                    │
│     └─ Send updated state to all players         │
│     └─ Send narration to all players             │
│     └─ Prompt next player for action             │
│                                                  │
│  6. CHECK TRANSITIONS                            │
│     └─ Should phase change? (combat end, etc.)   │
│     └─ Any triggered events?                     │
│     └─ Loop back to step 1                       │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 3. Phase-Specific Loops

### 3.1 Exploration Loop

```
AI describes current scene
        │
        ▼
Players can: ─────────────────────────────────────┐
  │                                                │
  ├─ "I look around" → Perception check → AI      │
  │   narrates what they find                      │
  │                                                │
  ├─ "I go north" → Move to new scene → AI        │
  │   describes new scene                          │
  │                                                │
  ├─ "I talk to the merchant" → Transition to      │
  │   SOCIAL phase                                 │
  │                                                │
  ├─ "I search the chest" → Investigation check → │
  │   AI narrates contents                         │
  │                                                │
  ├─ "I take a short rest" → Transition to REST    │
  │                                                │
  └─ AI triggers encounter → Transition to COMBAT  │
                                                   │
  ◄────────────────────────────────────────────────┘
```

**Key Rules**:
- Players act in any order (no initiative in exploration)
- Multiple players can act simultaneously
- AI decides when skill checks are needed and sets DCs
- AI can trigger events/encounters at any time

### 3.2 Combat Loop

```
┌─────────────────────────────────────────┐
│  COMBAT START                            │
│  1. Roll initiative for all combatants   │
│  2. Sort by initiative (high → low)      │
│  3. AI narrates combat start             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  ROUND START (round_number++)            │
│  - Reset reactions for all combatants    │
│  - Process start-of-round effects        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  TURN: Current combatant                 │
│                                          │
│  If PLAYER:                              │
│    - Show available actions              │
│    - Wait for player input               │
│    - Validate and resolve action         │
│    - AI narrates result                  │
│                                          │
│  If MONSTER/NPC:                         │
│    - AI decides action (validated)       │
│    - Engine resolves action              │
│    - AI narrates result                  │
│                                          │
│  Process: movement + action + bonus      │
│  Mark turn complete                      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  CHECK: All combatants acted this round? │
│                                          │
│  NO  → Next combatant in initiative ─────┼──► Back to TURN
│  YES → Process end-of-round effects      │
│         └─ Check combat end conditions   │
│                                          │
│  COMBAT OVER?                            │
│  (all enemies dead/fled/surrendered OR   │
│   all players dead/fled)                 │
│                                          │
│  NO  → Back to ROUND START              │
│  YES → Transition to EXPLORATION ────────┼──► Exit combat
└─────────────────────────────────────────┘
```

**Combat Turn Detail**:
```typescript
interface TurnActions {
  // Player chooses in any order within their turn:
  movement: {
    distance: number;        // Up to speed (usually 30ft)
    // Can split: move 15ft, attack, move 15ft
  };
  action: {
    type: ActionType;        // attack, cast_spell, dash, dodge, etc.
    target?: string;
    details?: any;
  };
  bonus_action?: {
    type: ActionType;        // Only if class/spell grants one
    target?: string;
  };
  // Reaction is used on OTHER turns (opportunity attacks, etc.)
}
```

### 3.3 Social Loop

```
AI introduces NPC and sets the scene
        │
        ▼
Player speaks/acts ──────────────────────────────┐
  │                                               │
  ├─ Free text input → AI responds as NPC         │
  │                                               │
  ├─ Persuasion/Deception/Intimidation attempt    │
  │   → AI sets DC → Player rolls → AI narrates  │
  │                                               │
  ├─ Insight check on NPC                         │
  │   → Roll vs DC → AI reveals NPC intentions    │
  │                                               │
  ├─ Player attacks NPC → Transition to COMBAT    │
  │                                               │
  └─ Player leaves conversation → Back to         │
     EXPLORATION                                  │
                                                  │
  ◄───────────────────────────────────────────────┘
```

### 3.4 Rest Loop

```
Player(s) declare rest type
        │
        ├─ SHORT REST (1 hour game time)
        │   1. Each player may spend Hit Dice to heal
        │   2. Some class features recharge
        │   3. AI may trigger an interruption (random encounter)
        │   4. If uninterrupted → back to EXPLORATION
        │
        └─ LONG REST (8 hours game time)
            1. Full HP recovery
            2. Recover all spell slots
            3. Recover half total Hit Dice
            4. Reset death saves
            5. AI may trigger night encounter
            6. If uninterrupted → back to EXPLORATION
```

---

## 4. Turn Timer (Optional)

To keep multiplayer flowing:

| Phase | Timer | On Timeout |
|-------|-------|-----------|
| Combat (player turn) | 60 seconds | Auto-dodge action |
| Exploration | No timer | Players act freely |
| Social | No timer | Players act freely |
| Character Creation | 5 minutes | Auto-generate remaining choices |

---

## 5. AI DM Decision Points

The AI is consulted at specific moments:

| Trigger | AI Input | AI Output |
|---------|----------|-----------|
| New scene entered | Scene context, party composition | Scene description, NPCs present, hidden elements |
| Player free-text action | Action text, game context | Required check (if any), DC, narration |
| Skill check result | Check type, success/fail, margin | Consequence narration, state changes |
| Combat start | Encounter context | Battle description, monster tactics hint |
| Monster turn | Monster stats, battlefield state | Chosen action and target |
| Combat end | Battle outcome | Victory/defeat narration, loot |
| NPC dialogue | NPC personality, dialogue history | NPC response in character |
| Rest interruption check | Party location, danger level | Whether encounter happens (and what) |

---

## 6. Error and Edge Cases

| Scenario | Handling |
|----------|---------|
| Player disconnects mid-combat | Character auto-dodges each turn; reconnect within 5 min or character retreats |
| AI response timeout (>10s) | Use fallback narration template; retry once; if still failing, proceed with mechanical-only resolution |
| All players at 0 HP | TPK (Total Party Kill) — AI narrates defeat, offer restart or rescue scenario |
| Invalid player action | Return error message, re-prompt for valid action |
| Player tries to attack ally | Allow it (D&D permits PvP) but confirm with "Are you sure?" |
| Simultaneous player actions (exploration) | Process in order received; queue if conflicting |
