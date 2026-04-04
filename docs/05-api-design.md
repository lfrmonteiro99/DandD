# API Design

## Overview

The API has two layers:
1. **REST API** — Stateless CRUD operations (sessions, characters, auth)
2. **WebSocket** — Real-time game state sync and player actions

Base URL: `https://<app>.vercel.app/api`
WebSocket: `wss://<app>.vercel.app/ws`

---

## 1. REST API Endpoints

### Authentication

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| POST | `/api/auth/register` | Create account | `{ username, email, password }` | `{ user_id, token }` |
| POST | `/api/auth/login` | Login | `{ email, password }` | `{ user_id, token }` |
| POST | `/api/auth/logout` | Logout | — | `{ success }` |
| GET | `/api/auth/me` | Current user | — | `{ user }` |

### Sessions

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| POST | `/api/sessions` | Create session | `{ name, max_players }` | `{ session }` |
| GET | `/api/sessions` | List joinable sessions | — | `{ sessions[] }` |
| GET | `/api/sessions/:id` | Get session details | — | `{ session, players[] }` |
| POST | `/api/sessions/:id/join` | Join session | — | `{ session, player_slot }` |
| POST | `/api/sessions/:id/leave` | Leave session | — | `{ success }` |
| POST | `/api/sessions/:id/start` | Start game (host only) | — | `{ game_state }` |

### Characters

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|-------------|----------|
| POST | `/api/characters` | Create character | `{ session_id, name, race, class, abilities }` | `{ character }` |
| GET | `/api/characters/:id` | Get character sheet | — | `{ character }` |
| PUT | `/api/characters/:id` | Update character (pre-game) | `{ ...updates }` | `{ character }` |
| GET | `/api/sessions/:id/characters` | All characters in session | — | `{ characters[] }` |

### Game State (for reconnection)

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/sessions/:id/state` | Current game state snapshot | `{ game_state }` |
| GET | `/api/sessions/:id/log` | Game log (paginated) | `{ entries[], cursor }` |

---

## 2. WebSocket Events

### Connection

```typescript
// Client connects with auth token and session ID
ws.connect('wss://app.vercel.app/ws', {
  auth: { token: 'jwt_token' },
  query: { session_id: 'uuid' }
});
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `player:action` | `{ action_type, target_id?, details? }` | Player performs a game action |
| `player:chat` | `{ message }` | Out-of-character chat |
| `player:roll` | `{ skill?, ability?, purpose }` | Player initiates a roll |
| `player:ready` | `{ ready: boolean }` | Player ready in lobby/char creation |
| `player:end_turn` | `{}` | Explicitly end combat turn |
| `combat:select_action` | `{ action_type, target_id, weapon_id? }` | Select combat action |
| `combat:select_spell` | `{ spell_id, target_id?, level? }` | Cast a spell |
| `rest:spend_hit_die` | `{}` | Spend hit die during short rest |
| `rest:complete` | `{}` | Confirm rest completion |

**`player:action` Payload Examples**:

```typescript
// Attack in combat
{ action_type: "attack", target_id: "goblin_1", details: { weapon_id: "longsword" } }

// Free text exploration
{ action_type: "free_text", details: { text: "I search the room for hidden doors" } }

// Move to location
{ action_type: "move", details: { direction: "north" } }

// Talk to NPC
{ action_type: "talk", target_id: "merchant_1", details: { text: "How much for the potion?" } }

// Use item
{ action_type: "use_item", details: { item_id: "healing_potion", target_id: "self" } }

// Cast spell
{ action_type: "cast_spell", details: { spell_id: "magic_missile", target_id: "goblin_1", level: 1 } }
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state_update` | `{ game_state }` | Full or partial state update |
| `game:narration` | `{ text, mood?, scene_image? }` | AI DM narration text |
| `game:phase_change` | `{ from, to, context }` | Game phase transition |
| `game:error` | `{ message, code }` | Action rejected / error |
| `combat:start` | `{ initiative_order[], narration }` | Combat begins |
| `combat:turn` | `{ entity_id, entity_name, available_actions[] }` | Whose turn it is |
| `combat:result` | `{ action, rolls[], result, narration }` | Action resolution |
| `combat:end` | `{ outcome, xp_earned?, loot?, narration }` | Combat over |
| `dice:roll` | `{ roller, roll_data, purpose }` | Dice roll result (for animation) |
| `player:joined` | `{ user_id, username }` | Player joined session |
| `player:left` | `{ user_id, username }` | Player left session |
| `player:disconnected` | `{ user_id }` | Player lost connection |
| `player:reconnected` | `{ user_id }` | Player reconnected |
| `check:request` | `{ player_id, skill, dc_visible? }` | Server requests a skill check |
| `check:result` | `{ player_id, skill, roll, total, success, narration }` | Skill check outcome |
| `npc:dialogue` | `{ npc_id, npc_name, text }` | NPC speaks |
| `rest:start` | `{ type, duration }` | Rest period begins |
| `rest:interrupt` | `{ encounter }` | Rest interrupted by encounter |
| `rest:complete` | `{ recoveries }` | Rest benefits applied |
| `system:message` | `{ text }` | System notification |

---

## 3. WebSocket Message Flow Diagrams

### Combat Round Flow

```
Server                          Player Client
  │                                  │
  ├──combat:turn {entity: player1}──►│  "Your turn!"
  │                                  │
  │◄──combat:select_action──────────│  Player picks attack
  │   {action: attack, target: gob} │
  │                                  │
  ├──dice:roll {d20, result: 17}───►│  Show dice animation
  │                                  │
  ├──dice:roll {d8, result: 6}─────►│  Damage roll
  │                                  │
  ├──combat:result {hit: true,──────►│  Update UI
  │   damage: 9, narration: "..."}  │
  │                                  │
  ├──game:state_update {hp...}─────►│  Update state
  │                                  │
  ├──combat:turn {entity: goblin}──►│  "Goblin's turn..."
  │                                  │
  │ [Server resolves goblin action]  │
  │                                  │
  ├──combat:result {goblin attacks}─►│  Show result
  │                                  │
  ├──combat:turn {entity: player2}──►│  Next player's turn
  │                                  │
```

### Exploration Skill Check Flow

```
Server                          Player Client
  │                                  │
  │◄──player:action {free_text:─────│  "I search for traps"
  │    "I search for traps"}         │
  │                                  │
  │ [AI decides: Investigation DC14] │
  │                                  │
  ├──check:request {skill:──────────►│  "Roll Investigation"
  │   investigation}                 │
  │                                  │
  │◄──player:roll {skill:──────────│  Player clicks roll
  │    investigation}                │
  │                                  │
  │ [Engine: d20(16)+INT(2)+Prof(2) │
  │  = 20 vs DC 14 = SUCCESS]       │
  │                                  │
  ├──dice:roll {d20, result: 16}───►│  Show dice
  │                                  │
  ├──check:result {success: true,───►│  Show result
  │   total: 20, narration: "You    │
  │   notice a thin wire..."}        │
  │                                  │
```

---

## 4. Error Codes

| Code | Meaning |
|------|---------|
| `NOT_YOUR_TURN` | Player tried to act out of turn in combat |
| `INVALID_ACTION` | Action type not available in current phase |
| `INVALID_TARGET` | Target doesn't exist or is out of range |
| `INSUFFICIENT_RESOURCES` | No spell slots, already used action, etc. |
| `SESSION_FULL` | Cannot join, max players reached |
| `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `NOT_IN_SESSION` | Player not a member of this session |
| `CHARACTER_REQUIRED` | Action requires a character but none exists |
| `UNAUTHORIZED` | Invalid or missing auth token |

---

## 5. Rate Limiting

| Endpoint Type | Limit |
|--------------|-------|
| Auth endpoints | 5 req/min per IP |
| REST API | 30 req/min per user |
| WebSocket messages | 10 msg/sec per user |
| AI-triggering actions | 5 req/min per session (to manage Claude API costs) |

---

## 6. Authentication Strategy

**MVP**: Simple JWT-based auth.

1. User registers/logs in → receives JWT token
2. Token stored in httpOnly cookie + sent in WebSocket auth
3. REST API validates token on each request
4. WebSocket validates token on connection
5. Token expiry: 24 hours, refresh on activity

**Future**: OAuth (Google, Discord) for easy onboarding.
