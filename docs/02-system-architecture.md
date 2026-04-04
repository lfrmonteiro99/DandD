# System Architecture

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Player 1 │  │ Player 2 │  │ Player 3 │  │ Player 4 │           │
│  │  React   │  │  React   │  │  React   │  │  React   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │              │                 │
└───────┼──────────────┼──────────────┼──────────────┼────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API / WEBSOCKET LAYER                           │
│                         (Node.js Server)                             │
│                                                                      │
│  ┌──────────────────┐    ┌───────────────────────────┐              │
│  │   REST API        │    │   WebSocket Server         │              │
│  │   /api/sessions   │    │   Real-time state sync     │              │
│  │   /api/characters │    │   Player action broadcast  │              │
│  │   /api/auth       │    │   DM narration push        │              │
│  └────────┬─────────┘    └─────────────┬─────────────┘              │
│           │                             │                            │
└───────────┼─────────────────────────────┼────────────────────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GAME ENGINE                                  │
│                                                                      │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐         │
│  │ Rules Engine   │  │ State Machine│  │ Combat Resolver  │         │
│  │ (Deterministic)│  │ (Game Phase) │  │ (Dice + Damage)  │         │
│  └───────┬───────┘  └──────┬───────┘  └────────┬─────────┘         │
│          │                  │                    │                    │
│  ┌───────┴──────────────────┴────────────────────┴───────┐          │
│  │              Game State Manager                        │          │
│  │        (Single Source of Truth)                         │          │
│  └────────────────────┬──────────────────────────────────┘          │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
            ┌───────────┼───────────┐
            ▼                       ▼
┌────────────────────┐  ┌────────────────────────────────┐
│     AI DM LAYER    │  │         DATABASE                │
│                    │  │                                  │
│  ┌──────────────┐  │  │  ┌─────────────┐               │
│  │ Context      │  │  │  │  Sessions   │               │
│  │ Builder      │  │  │  │  Characters │               │
│  ├──────────────┤  │  │  │  Game State │               │
│  │ Claude API   │◄─┼──┼─►│  Game Log   │               │
│  │ Client       │  │  │  │  Campaigns  │               │
│  ├──────────────┤  │  │  └─────────────┘               │
│  │ Response     │  │  │                                  │
│  │ Parser       │  │  │  (PostgreSQL via Vercel         │
│  └──────────────┘  │  │   Postgres / Neon)              │
│                    │  │                                  │
└────────────────────┘  └──────────────────────────────────┘
```

## 2. Component Breakdown

### 2.1 Frontend (React SPA)

**Responsibility**: All player-facing UI and interaction.

**Key Views**:
| View | Purpose | Key Components |
|------|---------|---------------|
| Lobby | Create/join sessions | Session list, Join form, Create form |
| Character Creation | Build a character | Race/Class selector, Stat assignment, Name input |
| Game View | Main gameplay | Narrative panel, Action input, Player status bars |
| Combat View | Turn-based combat | Initiative tracker, Action buttons, Target selector, Dice animation |
| Character Sheet | View/manage character | Stats, skills, inventory, HP tracker |

**State Management**: Zustand (lightweight, no boilerplate)
- Local UI state in components
- Game state received via WebSocket, stored in global store
- Optimistic updates for responsiveness

**Tech**: React 18+ with Next.js (for Vercel deployment), TypeScript, Tailwind CSS.

### 2.2 API Layer

**REST Endpoints** (stateless, for CRUD operations):
- Session management (create, join, list)
- Character CRUD
- Authentication (simple session-based)

**WebSocket Server** (stateful, for real-time):
- Game state synchronization
- Player action submission
- DM narration broadcast
- Combat turn notifications

**Tech**: Next.js API routes (REST) + separate WebSocket server (Socket.io or Vercel's native WebSocket support).

### 2.3 Game Engine

**The core of the system. Entirely deterministic. No AI dependency.**

| Module | Responsibility | Input | Output |
|--------|---------------|-------|--------|
| **Dice Roller** | Generate random results | Die type (d4-d20), count, advantage/disadvantage | Roll result, individual dice values |
| **Rules Engine** | Validate actions, calculate modifiers | Action + character state | Whether action is legal, calculated modifier |
| **Combat Resolver** | Resolve attacks, damage, saves | Attacker, target, action type | Hit/miss, damage dealt, conditions applied |
| **State Machine** | Track game phase | Current state + trigger event | New state (exploration/combat/social/rest) |
| **Character Manager** | Apply level rules, validate builds | Character data | Calculated stats (AC, HP, modifiers, proficiencies) |
| **Initiative Tracker** | Manage turn order | Combatant list | Sorted initiative order, current turn |

**Critical Design Rule**: The game engine resolves ALL mechanical outcomes. The AI never determines dice results, damage numbers, or hit/miss. The AI only decides:
- What NPCs/monsters do (choose actions)
- Story consequences of player actions
- Environmental descriptions
- DC for non-combat checks

### 2.4 AI DM Layer

**Responsibility**: Narrative generation, NPC behavior, story progression.

**Architecture**:
```
┌─────────────────────────────────────────┐
│            AI DM Layer                   │
│                                          │
│  ┌────────────────────┐                 │
│  │  Context Builder   │                 │
│  │  - Current scene   │                 │
│  │  - Combat state    │                 │
│  │  - Player history  │                 │
│  │  - Character info  │                 │
│  │  - Recent actions  │                 │
│  └────────┬───────────┘                 │
│           ▼                              │
│  ┌────────────────────┐                 │
│  │  Prompt Template   │                 │
│  │  Engine            │                 │
│  │  - System prompt   │                 │
│  │  - Game rules ref  │                 │
│  │  - Output format   │                 │
│  └────────┬───────────┘                 │
│           ▼                              │
│  ┌────────────────────┐                 │
│  │  Claude API Call   │                 │
│  └────────┬───────────┘                 │
│           ▼                              │
│  ┌────────────────────┐                 │
│  │  Response Parser   │                 │
│  │  - Extract narration│                │
│  │  - Extract DM      │                 │
│  │    decisions        │                 │
│  │  - Validate against │                │
│  │    rules engine     │                 │
│  └────────────────────┘                 │
│                                          │
└─────────────────────────────────────────┘
```

**AI Output Format** (structured JSON from Claude):
```json
{
  "narration": "The goblin snarls and lunges at you with its rusty scimitar...",
  "dm_decisions": {
    "npc_actions": [{"npc_id": "goblin_1", "action": "attack", "target": "player_1"}],
    "dc_assignments": [{"check": "perception", "dc": 14}],
    "scene_changes": {"new_location": null, "environment_effects": []},
    "encounter_trigger": null
  },
  "suggested_checks": ["perception", "investigation"],
  "mood": "tense"
}
```

**Guardrails**: The response parser validates all AI decisions against the rules engine before applying them. If the AI suggests an impossible action (e.g., dead NPC attacks), the engine rejects it and re-prompts.

### 2.5 Database

**Tech**: Vercel Postgres (Neon) — serverless PostgreSQL.

**Responsibilities**:
- Persist session state across server restarts
- Store character sheets
- Log game history for context building
- Campaign progression and save state

**Schema** detailed in `03-data-models.md`.

---

## 3. Key Design Decisions

### 3.1 Rules Engine ≠ AI
The rules engine is **deterministic and separated from AI**. This ensures:
- Dice rolls are fair and verifiable
- Combat math is consistent
- AI cannot break game rules
- Game works even if AI is slow/unavailable (degrade to mechanical resolution)

### 3.2 Server-Authoritative Game State
- Server holds the **single source of truth**
- Clients receive state via WebSocket
- Player actions are **requests** — server validates and applies (or rejects)
- No client-side game logic except display calculations

### 3.3 WebSocket for Real-Time
- All players in a session share one WebSocket room
- State updates broadcast to all players simultaneously
- Handles: turn notifications, narration, state changes, player join/leave
- Fallback: long-polling for environments that block WebSockets

### 3.4 AI Responses are Validated
- AI output is parsed into structured format
- Each AI decision passes through rules engine validation
- Invalid decisions are rejected or auto-corrected
- AI is **advisory** for game mechanics, **authoritative** only for narrative

### 3.5 Phased Complexity
- Start with Level 1 characters only
- 4 classes, 4 races
- Simple encounter types
- No multiclassing, feats, or advanced rules initially

---

## 4. Data Flow Examples

### 4.1 Player Attacks a Monster

```
Player clicks "Attack Goblin" in Combat UI
        │
        ▼
[WebSocket] → Server receives: { action: "attack", target: "goblin_1", weapon: "longsword" }
        │
        ▼
[Game Engine: Rules Engine]
  - Validate: Is it player's turn? ✓
  - Validate: Is target alive and in range? ✓
  - Calculate attack modifier: STR(+3) + Proficiency(+2) = +5
        │
        ▼
[Game Engine: Dice Roller]
  - Roll d20 → result: 14
  - Total: 14 + 5 = 19
  - Compare to Goblin AC (15): HIT
        │
        ▼
[Game Engine: Combat Resolver]
  - Roll damage: 1d8 → result: 6
  - Total damage: 6 + 3 (STR) = 9
  - Apply to Goblin HP: 7 - 9 = -2 → Goblin dies
        │
        ▼
[AI DM Layer]
  - Input: { event: "attack_hit", attacker: "Thorin", target: "Goblin", 
             damage: 9, roll: 14, target_killed: true, weapon: "longsword" }
  - Claude generates: "With a mighty swing, Thorin's longsword cleaves 
    through the goblin's guard. The creature crumples to the ground."
        │
        ▼
[WebSocket Broadcast] → All players receive:
  {
    type: "combat_result",
    narration: "With a mighty swing...",
    mechanical: { attacker: "Thorin", roll: 19, damage: 9, target_killed: true },
    updated_state: { ... }
  }
```

### 4.2 Player Talks to NPC

```
Player types: "I try to convince the merchant to lower his prices"
        │
        ▼
[WebSocket] → Server receives: { action: "free_text", text: "..." }
        │
        ▼
[AI DM Layer]
  - Context: Current scene (merchant shop), NPC (merchant, disposition: neutral),
             Player character (Rogue, CHA 14)
  - Claude decides: This requires a Persuasion check, DC 13
  - Response: { check_required: { skill: "persuasion", dc: 13 }, 
               narration: "The merchant eyes you suspiciously..." }
        │
        ▼
[WebSocket] → Player receives: "The merchant eyes you suspiciously. Roll Persuasion."
        │
        ▼
Player clicks "Roll Persuasion"
        │
        ▼
[Game Engine: Dice Roller]
  - Roll d20 → 15
  - Persuasion modifier: CHA(+2) + Proficiency(+2) = +4
  - Total: 15 + 4 = 19 vs DC 13: SUCCESS
        │
        ▼
[AI DM Layer]
  - Input: { check: "persuasion", result: "success", margin: 6 }
  - Claude generates: "The merchant sighs and scratches his beard. 'Fine, 
    fine... I'll give you 10% off. But don't tell anyone!'"
        │
        ▼
[WebSocket Broadcast] → All players receive narration + updated prices
```

### 4.3 Combat Initiative Starts

```
AI DM decides: hostile encounter triggered (players enter ambush)
        │
        ▼
[Game Engine: State Machine]
  - Transition: EXPLORATION → COMBAT
  - Trigger: initiative_roll
        │
        ▼
[Game Engine: Initiative Tracker]
  - Player 1 (Fighter, DEX +1): d20(12) + 1 = 13
  - Player 2 (Wizard, DEX +2):  d20(7)  + 2 = 9
  - Player 3 (Rogue, DEX +3):   d20(18) + 3 = 21
  - Goblin 1 (DEX +2):          d20(15) + 2 = 17
  - Goblin 2 (DEX +2):          d20(4)  + 2 = 6
  
  Turn order: Rogue(21) → Goblin1(17) → Fighter(13) → Wizard(9) → Goblin2(6)
        │
        ▼
[AI DM Layer]
  - Input: { event: "combat_start", enemies: ["Goblin x2"], 
             initiative_order: [...], scene: "forest clearing" }
  - Claude generates: "Arrows fly from the treeline! Two goblins burst from 
    the undergrowth, weapons drawn. Roll for initiative! 
    [Rogue], your reflexes are the sharpest — you act first."
        │
        ▼
[WebSocket Broadcast] → All players receive:
  - Combat start notification
  - Initiative order display
  - AI narration
  - First player prompted for action
```
