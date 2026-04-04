# D&D Arena — AI Dungeon Master

A browser-based Dungeons & Dragons 5e game where an AI (Claude) acts as the Dungeon Master. Multiple players join sessions via browser, create characters, explore, fight, and roleplay — all in real-time.

## Architecture

```
React Frontend → REST API + WebSocket → Game Engine → AI DM (Claude) → Database
```

- **Rules Engine**: Deterministic. Handles all dice rolls, combat math, character validation.
- **AI DM**: Narrative only. Describes scenes, roleplays NPCs, decides monster actions. Cannot override game rules.
- **Real-time**: WebSocket-based state sync (Socket.io for dev, Ably for production).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS, Zustand |
| API | Next.js API Routes (serverless) |
| AI | Claude API (Anthropic SDK) |
| Database | In-memory (MVP), Vercel Postgres for production |
| Hosting | Vercel |

## Project Structure

```
src/
├── app/                    # Next.js pages + API routes
│   ├── page.tsx            # Main page (auth, lobby, game)
│   └── api/                # REST API endpoints
│       ├── auth/           # Register, login, me
│       ├── sessions/       # CRUD + join
│       ├── characters/     # Character creation
│       └── game/           # Action, start, state, roll
├── engine/                 # Deterministic game engine
│   ├── types.ts            # All TypeScript types
│   ├── dice.ts             # Dice roller (d4-d100, advantage/disadvantage)
│   ├── character.ts        # Character creation, stats, HP, spells
│   ├── combat.ts           # Initiative, attacks, damage, death saves
│   └── state-machine.ts    # Game phase transitions
├── ai/                     # AI DM layer
│   ├── dm.ts               # Claude API integration
│   ├── prompts.ts          # Prompt templates
│   └── context-builder.ts  # Game state → prompt context
├── server/                 # Game server
│   ├── game-loop.ts        # Core game loop processing
│   ├── session-manager.ts  # Session lifecycle
│   └── ws-handler.ts       # WebSocket handler
├── data/                   # Static game data
│   ├── classes.ts          # Fighter, Wizard, Rogue, Cleric
│   ├── races.ts            # Human, Elf, Dwarf, Halfling
│   ├── weapons.ts          # 9 weapons
│   ├── armor.ts            # Light, medium, heavy + shield
│   ├── monsters.ts         # 7 monster templates
│   └── spells.ts           # 14 spells (cantrips + level 1)
├── components/             # React UI components
│   ├── lobby/              # Auth form, session lobby
│   ├── character/          # Character creation wizard
│   ├── game/               # Main game view
│   ├── combat/             # Combat UI
│   └── ui/                 # Button, HPBar, DiceDisplay
├── store/                  # Zustand state management
└── lib/                    # Auth, DB, API client
```

## MVP Scope

- 4 races: Human, Elf, Dwarf, Halfling
- 4 classes: Fighter, Wizard, Rogue, Cleric
- Level 1 characters, Standard Array
- 14 spells (cantrips + level 1)
- 7 monster types
- Full combat: initiative, attacks, damage, death saves, spellcasting
- AI DM: scene narration, NPC dialogue, monster tactics, skill check DCs
- Exploration with skill checks
- Short/long rest mechanics
- Up to 4 players per session

## Getting Started

```bash
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY and JWT_SECRET
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/sessions | Create session |
| GET | /api/sessions | List sessions |
| POST | /api/sessions/join | Join session |
| POST | /api/characters | Create character |
| POST | /api/game/start | Start game (AI generates opening) |
| POST | /api/game/action | Send player action (AI responds) |
| POST | /api/game/roll | Roll skill check |
| GET | /api/game/state | Get current game state |

## Design Documents

| Document | Description |
|----------|-------------|
| [01 — D&D Mechanics Research](docs/01-dnd-mechanics-research.md) | Core rules, dice system, combat, character creation |
| [02 — System Architecture](docs/02-system-architecture.md) | Components, data flow, design decisions |
| [03 — Data Models](docs/03-data-models.md) | TypeScript interfaces, SQL schemas |
| [04 — Game Loop & State Machine](docs/04-game-loop-state-machine.md) | Phase transitions, combat loop |
| [05 — API Design](docs/05-api-design.md) | REST endpoints, WebSocket events |
| [06 — Implementation Plan](docs/06-implementation-plan.md) | Step-by-step build phases |
| [07 — Deployment Strategy](docs/07-deployment-strategy.md) | Vercel setup, costs, scaling |

## License

MIT
