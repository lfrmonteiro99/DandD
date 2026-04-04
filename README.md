# D&D Web Game — AI Dungeon Master

A browser-based Dungeons & Dragons 5e game where an AI (Claude) acts as the Dungeon Master. Multiple players join sessions via browser, create characters, explore, fight, and roleplay — all in real-time.

## Architecture

```
React Frontend → REST API + WebSocket → Game Engine → AI DM (Claude) → Database
```

- **Rules Engine**: Deterministic. Handles all dice rolls, combat math, character validation.
- **AI DM**: Narrative only. Describes scenes, roleplays NPCs, decides monster actions. Cannot override game rules.
- **Real-time**: WebSocket-based state sync for all players in a session.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Zustand |
| API | Next.js API Routes (serverless) |
| Real-time | Ably (managed WebSocket) |
| AI | Claude API (Anthropic SDK) |
| Database | Vercel Postgres (Neon) |
| ORM | Drizzle |
| Hosting | Vercel |

## MVP Scope

- 4 races: Human, Elf, Dwarf, Halfling
- 4 classes: Fighter, Wizard, Rogue, Cleric
- Level 1 characters
- Core combat: initiative, attacks, damage, death saves
- AI DM: scene narration, NPC dialogue, monster tactics
- Up to 4 players per session
- Session persistence

## Design Documents

| Document | Description |
|----------|-------------|
| [01 — D&D Mechanics Research](docs/01-dnd-mechanics-research.md) | Core rules, dice system, combat, character creation |
| [02 — System Architecture](docs/02-system-architecture.md) | Components, data flow, design decisions |
| [03 — Data Models](docs/03-data-models.md) | TypeScript interfaces, SQL schemas, entity relationships |
| [04 — Game Loop & State Machine](docs/04-game-loop-state-machine.md) | Phase transitions, combat loop, exploration loop |
| [05 — API Design](docs/05-api-design.md) | REST endpoints, WebSocket events, error codes |
| [06 — Implementation Plan](docs/06-implementation-plan.md) | Step-by-step build order, 6 phases |
| [07 — Deployment Strategy](docs/07-deployment-strategy.md) | Vercel setup, costs, scaling, security |

## Getting Started

```bash
npm install
cp .env.example .env.local
# Add: DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, ABLY_API_KEY
npm run db:migrate
npm run dev
```

## License

MIT
