# Step-by-Step Implementation Plan

## Phase Overview

```
Phase 0: Project Setup         (1-2 days)
Phase 1: Core Engine           (3-5 days)
Phase 2: API + WebSocket       (2-3 days)
Phase 3: AI DM Integration     (2-3 days)
Phase 4: Frontend MVP          (4-6 days)
Phase 5: Integration + Polish  (2-3 days)
Phase 6: Deploy + Test         (1-2 days)
```

Total estimated: ~3-4 weeks for a functional MVP.

---

## Phase 0: Project Setup

### 0.1 Initialize Repository
- [x] Create Git repo
- [ ] Initialize Next.js project with TypeScript
  ```bash
  npx create-next-app@latest dnd-game --typescript --tailwind --app --src-dir
  ```
- [ ] Configure ESLint, Prettier
- [ ] Set up project structure:
  ```
  src/
  ├── app/                    # Next.js app router pages
  │   ├── page.tsx            # Landing/lobby
  │   ├── session/[id]/       # Game view
  │   ├── character/create/   # Character creation
  │   └── api/                # API routes
  ├── engine/                 # Game engine (pure logic, no framework deps)
  │   ├── dice.ts
  │   ├── combat.ts
  │   ├── rules.ts
  │   ├── state-machine.ts
  │   ├── character.ts
  │   └── types.ts
  ├── ai/                     # AI DM layer
  │   ├── dm.ts
  │   ├── prompts.ts
  │   ├── context-builder.ts
  │   └── response-parser.ts
  ├── server/                 # Server-side game management
  │   ├── session-manager.ts
  │   ├── game-loop.ts
  │   └── ws-handler.ts
  ├── lib/                    # Shared utilities
  │   ├── db.ts
  │   ├── auth.ts
  │   └── constants.ts
  ├── components/             # React components
  │   ├── lobby/
  │   ├── character/
  │   ├── game/
  │   ├── combat/
  │   └── ui/
  ├── store/                  # Zustand stores
  │   ├── game-store.ts
  │   └── ui-store.ts
  └── data/                   # Static game data
      ├── classes.ts
      ├── races.ts
      ├── spells.ts
      ├── weapons.ts
      └── monsters.ts
  ```

### 0.2 Database Setup
- [ ] Create Vercel Postgres database (or Neon for local dev)
- [ ] Set up Drizzle ORM (lightweight, type-safe)
- [ ] Create initial migration with tables: users, sessions, session_players, characters, game_log
- [ ] Seed data: test users

### 0.3 Dev Environment
- [ ] Set up environment variables (.env.local):
  ```
  DATABASE_URL=
  ANTHROPIC_API_KEY=
  JWT_SECRET=
  NEXT_PUBLIC_WS_URL=
  ```
- [ ] Install key dependencies:
  ```
  npm install @anthropic-ai/sdk socket.io socket.io-client drizzle-orm
  npm install zustand @tanstack/react-query zod
  npm install -D drizzle-kit @types/node
  ```

---

## Phase 1: Core Engine (No UI, No Network)

**Goal**: Build the deterministic game engine as pure TypeScript functions. Fully testable without any server or UI.

### 1.1 Type Definitions (`engine/types.ts`)
- [ ] Define all TypeScript types from data models doc
- [ ] Character, Monster, GameState, CombatState, DiceRoll, etc.
- [ ] Export all types

### 1.2 Dice Roller (`engine/dice.ts`)
- [ ] `rollDie(type: DieType): number` — single die roll
- [ ] `rollDice(type: DieType, count: number): DiceRoll` — multiple dice
- [ ] `rollWithAdvantage(): DiceRoll` — 2d20 take higher
- [ ] `rollWithDisadvantage(): DiceRoll` — 2d20 take lower
- [ ] `rollAbilityCheck(modifier: number, proficient: boolean, profBonus: number): DiceRoll`
- [ ] `rollInitiative(dexModifier: number): DiceRoll`
- [ ] Write unit tests for all functions

### 1.3 Character Manager (`engine/character.ts`)
- [ ] `calculateModifier(abilityScore: number): number`
- [ ] `calculateAC(character: Character): number`
- [ ] `calculateMaxHP(character: Character): number`
- [ ] `calculateProficiencyBonus(level: number): number`
- [ ] `calculateSkillModifier(character: Character, skill: Skill): number`
- [ ] `createCharacter(input: CharacterInput): Character` — validate and build
- [ ] `applyDamage(character: Character, damage: number): Character`
- [ ] `applyHealing(character: Character, healing: number): Character`
- [ ] Write unit tests

### 1.4 Combat Resolver (`engine/combat.ts`)
- [ ] `rollInitiativeForAll(combatants: Combatant[]): InitiativeEntry[]`
- [ ] `resolveAttack(attacker, target, weapon): CombatResult`
- [ ] `resolveSpellAttack(caster, target, spell): CombatResult`
- [ ] `resolveSavingThrow(target, dc, ability): { success: boolean, roll: DiceRoll }`
- [ ] `applyDamage(target, damage, type): updated target`
- [ ] `processDeathSave(character): DeathSaveResult`
- [ ] `checkCombatEnd(state: CombatState): boolean`
- [ ] Write unit tests

### 1.5 State Machine (`engine/state-machine.ts`)
- [ ] Define state transitions (as per game loop doc)
- [ ] `transition(currentState: GamePhase, trigger: string): GamePhase`
- [ ] `getAvailableActions(phase: GamePhase, character: Character): ActionType[]`
- [ ] `validateAction(state: GameState, action: PlayerAction): ValidationResult`
- [ ] Write unit tests

### 1.6 Static Game Data (`data/`)
- [ ] `classes.ts` — Fighter, Wizard, Rogue, Cleric definitions (HP, proficiencies, features)
- [ ] `races.ts` — Human, Elf, Dwarf, Halfling (ability bonuses, traits)
- [ ] `weapons.ts` — Common weapons table
- [ ] `spells.ts` — Level 0-1 spells for Wizard and Cleric (10-15 spells)
- [ ] `monsters.ts` — 5 monster stat blocks (Goblin, Skeleton, Wolf, Bandit, Ogre)

---

## Phase 2: API + WebSocket Server

### 2.1 Auth (`app/api/auth/`)
- [ ] POST `/api/auth/register` — bcrypt password, generate JWT
- [ ] POST `/api/auth/login` — verify password, return JWT
- [ ] Middleware: `withAuth()` — validate JWT on protected routes
- [ ] GET `/api/auth/me` — return current user from token

### 2.2 Session Management (`app/api/sessions/`)
- [ ] POST `/api/sessions` — create session, creator becomes host
- [ ] GET `/api/sessions` — list open sessions (status=lobby)
- [ ] GET `/api/sessions/:id` — session details + players
- [ ] POST `/api/sessions/:id/join` — add player to session
- [ ] POST `/api/sessions/:id/start` — host starts game (validate all have characters)

### 2.3 Character CRUD (`app/api/characters/`)
- [ ] POST `/api/characters` — create character (validate using engine)
- [ ] GET `/api/characters/:id` — get character sheet

### 2.4 WebSocket Server (`server/ws-handler.ts`)
- [ ] Set up Socket.io server (custom server for Vercel, or use Ably/Pusher as alternative)
- [ ] Handle connection with JWT auth
- [ ] Room management: one room per session
- [ ] Handle all client→server events from API doc
- [ ] Broadcast all server→client events
- [ ] Handle disconnect/reconnect

### 2.5 Game Loop Server (`server/game-loop.ts`)
- [ ] `GameLoop` class that manages one active session
- [ ] Processes player actions through engine
- [ ] Calls AI DM layer at appropriate points
- [ ] Broadcasts state updates via WebSocket
- [ ] Persists state to DB on each significant action

---

## Phase 3: AI DM Integration

### 3.1 Context Builder (`ai/context-builder.ts`)
- [ ] Build system prompt with D&D rules reference
- [ ] Build scene context from current game state
- [ ] Build combat context (positions, HP, conditions)
- [ ] Build player history context (last 10 actions)
- [ ] Character summaries for party context
- [ ] Trim context to fit token limits (~4000 tokens for context)

### 3.2 Prompt Templates (`ai/prompts.ts`)
- [ ] `SYSTEM_PROMPT` — DM personality, rules, output format instructions
- [ ] `NARRATION_PROMPT` — For scene descriptions and action narration
- [ ] `COMBAT_NARRATION_PROMPT` — For combat event narration
- [ ] `NPC_DIALOGUE_PROMPT` — For NPC conversations
- [ ] `MONSTER_ACTION_PROMPT` — For AI deciding monster actions
- [ ] `CHECK_DC_PROMPT` — For AI setting DCs for skill checks
- [ ] `ENCOUNTER_PROMPT` — For generating encounters

### 3.3 Claude API Client (`ai/dm.ts`)
- [ ] Initialize Anthropic SDK client
- [ ] `generateNarration(context, event): Promise<DMResponse>`
- [ ] `generateNPCDialogue(context, npc, playerText): Promise<string>`
- [ ] `decideMonsterAction(context, monster): Promise<MonsterAction>`
- [ ] `setCheckDC(context, action): Promise<{ skill, dc }>`
- [ ] `generateEncounter(context): Promise<Encounter>`
- [ ] Error handling: timeout, retry, fallback responses

### 3.4 Response Parser (`ai/response-parser.ts`)
- [ ] Parse structured JSON from Claude responses
- [ ] Validate against game rules (e.g., monster can't use actions it doesn't have)
- [ ] Sanitize narration (remove potential rule-breaking statements)
- [ ] Fallback templates for malformed responses

### 3.5 AI DM Prompt Engineering
- [ ] System prompt that constrains Claude to:
  - Always respond in structured JSON format
  - Never determine dice outcomes (only narrate given outcomes)
  - Stay in character as DM
  - Reference game state accurately
  - Keep narration concise (2-4 sentences typical)
- [ ] Test with various game scenarios
- [ ] Refine based on response quality

---

## Phase 4: Frontend MVP

### 4.1 Layout & Navigation
- [ ] App shell with responsive layout
- [ ] Header with session info, player name
- [ ] Navigation between views
- [ ] Zustand store setup for game state

### 4.2 Lobby View (`app/page.tsx`)
- [ ] Session list (active lobbies)
- [ ] Create session button + modal
- [ ] Join session button
- [ ] Lobby waiting room (shows connected players)
- [ ] "Start Game" button (host only, when all players ready)

### 4.3 Character Creation (`app/character/create/page.tsx`)
- [ ] Step 1: Choose race (4 options with descriptions)
- [ ] Step 2: Choose class (4 options with descriptions)
- [ ] Step 3: Assign ability scores (Standard Array drag-and-drop)
- [ ] Step 4: Name and finalize
- [ ] Character preview with calculated stats
- [ ] Submit → validates on server → back to lobby

### 4.4 Game View (`app/session/[id]/page.tsx`)
- [ ] **Narrative Panel** (main area): Scrolling text of DM narration, actions, dialogue
- [ ] **Action Input** (bottom): Text input for free-form actions + quick action buttons
- [ ] **Party Panel** (sidebar): All player characters with HP bars, conditions
- [ ] **Character Quick View**: Current player's key stats
- [ ] WebSocket connection management (connect, disconnect, reconnect)

### 4.5 Combat View (overlay/mode on Game View)
- [ ] **Initiative Tracker**: Visual turn order bar
- [ ] **Action Panel**: Attack, Cast Spell, Dash, Dodge, etc. buttons
- [ ] **Target Selector**: Click to select target (list of valid targets)
- [ ] **Dice Animation**: Visual dice roll when results come in
- [ ] **Combat Log**: Actions and results for current combat
- [ ] Turn indicator ("Your turn!" / "Waiting for [Player]...")
- [ ] HP bars for monsters (if visible)

### 4.6 Character Sheet (modal/panel)
- [ ] Full stat display
- [ ] Skills list with modifiers
- [ ] Equipment list
- [ ] Spell list (for casters)
- [ ] HP/resource tracking

### 4.7 UI Components
- [ ] Dice roll animation component
- [ ] HP bar component
- [ ] Condition badge component
- [ ] Chat/narration bubble component
- [ ] Loading states and skeletons
- [ ] Toast notifications for game events

---

## Phase 5: Integration & Polish

### 5.1 End-to-End Flow Testing
- [ ] Create session → join → create characters → start game
- [ ] Exploration: move between scenes, skill checks
- [ ] Social: talk to NPC, persuasion check
- [ ] Combat: full combat encounter start-to-finish
- [ ] Rest: short rest, long rest
- [ ] Reconnection: disconnect and rejoin mid-game

### 5.2 Edge Case Handling
- [ ] Player disconnect during combat
- [ ] AI timeout fallback
- [ ] Invalid state recovery
- [ ] Browser refresh → reconnect to session

### 5.3 Performance
- [ ] WebSocket message batching (don't flood on rapid state changes)
- [ ] AI response streaming (show narration as it generates)
- [ ] Database query optimization (index game_log)
- [ ] Game state snapshot for fast reconnection

### 5.4 Polish
- [ ] Sound effects for dice rolls (optional)
- [ ] Smooth animations for combat results
- [ ] Mobile-responsive layout
- [ ] Error messages that make sense
- [ ] Loading states that aren't jarring

---

## Phase 6: Deploy & Test

### 6.1 Vercel Deployment
- [ ] Configure Vercel project
- [ ] Set up environment variables in Vercel dashboard
- [ ] Deploy Next.js app
- [ ] Set up Vercel Postgres (or connect Neon)
- [ ] Run database migrations in production
- [ ] WebSocket solution (see deployment doc for options)

### 6.2 Testing
- [ ] Unit tests: engine functions (Jest/Vitest)
- [ ] Integration tests: API endpoints
- [ ] WebSocket tests: connection, events, reconnection
- [ ] Manual playtesting: full game session with 2+ players
- [ ] AI DM quality testing: various scenarios

### 6.3 Monitoring
- [ ] Error tracking (Vercel built-in or Sentry)
- [ ] API response time monitoring
- [ ] AI cost tracking (Claude API usage)
- [ ] WebSocket connection health

---

## Priority Order (What to Build First)

If time is limited, build in this order:

1. **Engine** (dice + combat + character) — the game needs rules
2. **Static data** (classes, races, monsters) — the game needs content
3. **AI DM** (narration + monster actions) — the game needs a DM
4. **WebSocket + Game Loop** — multiplayer needs real-time
5. **Game View** (narrative panel + action input) — players need to play
6. **Combat View** — combat is the core gameplay
7. **Character Creation** — players need characters
8. **Lobby** — players need to find sessions
9. **Auth** — can use simple/mock auth initially
10. **Polish** — only after everything works
