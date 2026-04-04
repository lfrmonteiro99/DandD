# Deployment Strategy — Vercel

## 1. Architecture for Vercel

Vercel is optimized for serverless. This creates a challenge for WebSockets (which require persistent connections). Here's how to handle it:

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL                             │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │  Next.js App (Frontend + API)      │              │
│  │  - Static pages (SSG)              │              │
│  │  - API routes (serverless)         │              │
│  │  - Server components (SSR)         │              │
│  └──────────────────┬─────────────────┘              │
│                     │                                 │
│  ┌──────────────────┴─────────────────┐              │
│  │  Vercel Postgres (Neon)            │              │
│  │  - Session data                    │              │
│  │  - Character sheets                │              │
│  │  - Game logs                       │              │
│  └────────────────────────────────────┘              │
│                                                      │
└─────────────────────────────────────────────────────┘
         │
         │ Real-time layer (pick ONE):
         ▼
┌─────────────────────────────────────────────────────┐
│  Option A: Ably (Recommended for MVP)                │
│  - Managed WebSocket infrastructure                  │
│  - Free tier: 6M messages/month                      │
│  - SDK for React + Node                              │
│  - Pub/Sub model maps perfectly to game rooms        │
│                                                      │
│  Option B: Pusher                                    │
│  - Similar to Ably                                   │
│  - Free tier: 200K messages/day                      │
│                                                      │
│  Option C: PartyKit (Cloudflare)                     │
│  - Purpose-built for real-time multiplayer           │
│  - Runs on Cloudflare Workers (not Vercel)           │
│  - Stateful WebSocket rooms                          │
│  - Free tier generous for MVP                        │
│                                                      │
│  Option D: Self-hosted WebSocket (Railway/Fly.io)    │
│  - Full Socket.io server on a persistent host        │
│  - More control, more ops overhead                   │
│  - Vercel frontend → Railway WebSocket server        │
└─────────────────────────────────────────────────────┘
```

### Recommended: Option A (Ably) or Option C (PartyKit)

**Ably** is easiest to integrate with Vercel:
- API routes publish events to Ably channels
- Clients subscribe to channels via Ably SDK
- No server to manage
- Channel = session room

**PartyKit** is best for game-specific use:
- Each "party" = game session with persistent state
- Server-side logic runs in the party (game engine lives here)
- Built-in room management
- Slightly more setup but better fit for game architecture

---

## 2. Environment Configuration

### Vercel Environment Variables

```bash
# Database
DATABASE_URL=postgres://...@ep-xxx.us-east-2.aws.neon.tech/neondb

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Auth
JWT_SECRET=<random-256-bit-hex>
NEXTAUTH_SECRET=<random-256-bit-hex>

# Real-time (Ably example)
ABLY_API_KEY=xxxxx.xxxxxx:xxxxxxxxxxxxxxxxx
NEXT_PUBLIC_ABLY_KEY=xxxxx.xxxxxx:xxxxxxxxxxxxxxxxx  # Public subscribe-only key

# App
NEXT_PUBLIC_APP_URL=https://dnd-game.vercel.app
NODE_ENV=production
```

---

## 3. Database Setup

### Vercel Postgres (Neon)

1. Create database in Vercel dashboard (Storage → Create → Postgres)
2. Copy connection string to `DATABASE_URL`
3. Run migrations:
   ```bash
   npx drizzle-kit push:pg
   ```

### Schema Migrations Strategy
- Use Drizzle Kit for migrations
- Migration files checked into Git
- Run migrations as part of deploy (Vercel build step):
  ```json
  // package.json
  {
    "scripts": {
      "build": "npm run db:migrate && next build",
      "db:migrate": "drizzle-kit push:pg",
      "db:generate": "drizzle-kit generate:pg"
    }
  }
  ```

---

## 4. Deployment Pipeline

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Git Push │────►│  Vercel  │────►│  Build   │────►│  Deploy  │
│ (main)   │     │  Trigger │     │  + Migrate│     │  Live    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                       │
                      ┌────────────────┤
                      ▼                ▼
                 ┌──────────┐   ┌──────────────┐
                 │ DB Migrate│   │ Next.js Build │
                 │ (Drizzle) │   │ (SSG + API)   │
                 └──────────┘   └──────────────┘
```

### Branch Strategy
- `main` — production deployments
- `develop` — staging (Vercel preview deployments)
- Feature branches — per-feature previews

### Vercel Configuration (`vercel.json`)
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "crons": []
}
```

---

## 5. Cost Estimation (MVP)

| Service | Free Tier | Estimated Usage | Monthly Cost |
|---------|-----------|----------------|-------------|
| Vercel (Hobby) | 100GB bandwidth, serverless | Sufficient for MVP | $0 |
| Vercel Postgres | 256MB storage, 60hrs compute | ~50 sessions | $0 |
| Ably | 6M messages/month | ~2M messages | $0 |
| Claude API | Pay per token | ~$0.015/request × 500 req/session | ~$10-30/month |
| Domain (optional) | — | — | ~$12/year |

**Total MVP cost: ~$10-30/month** (almost entirely Claude API usage)

### Claude API Cost Optimization
- Cache system prompts (reduce input tokens)
- Keep context window small (recent history only, not full log)
- Use `claude-haiku-4-5-20251001` for simple narration, `claude-sonnet-4-6` for complex decisions
- Batch multiple narration requests where possible
- Set max_tokens appropriately (200 for narration, 500 for complex scenes)

---

## 6. Scaling Considerations (Post-MVP)

| Concern | Solution |
|---------|---------|
| More concurrent sessions | PartyKit or dedicated WebSocket server (Railway) |
| Database scaling | Neon auto-scales; add connection pooling |
| AI latency | Response streaming, pre-generate common narrations |
| CDN / Static assets | Vercel Edge Network (automatic) |
| Multiple regions | Vercel Edge Functions for API, multi-region DB |

---

## 7. Monitoring & Observability

### Built-in (Vercel)
- Function execution logs
- Deployment status
- Web analytics
- Speed insights

### Add-on (Recommended)
- **Sentry** — Error tracking (free tier: 5K events/month)
- **PostHog** — Product analytics (free tier: 1M events/month)
- Custom logging for:
  - AI response times and quality
  - Game session duration and engagement
  - WebSocket connection stability

---

## 8. Security Checklist

- [ ] All API routes require authentication (except auth endpoints)
- [ ] JWT tokens have reasonable expiry (24h)
- [ ] Database credentials never exposed to client
- [ ] Claude API key server-side only
- [ ] Rate limiting on all endpoints
- [ ] Input sanitization (player text input → prevent injection)
- [ ] WebSocket connections authenticated
- [ ] CORS configured for production domain only
- [ ] Environment variables not in Git (use .env.local + Vercel dashboard)

---

## 9. Local Development Setup

```bash
# 1. Clone repo
git clone <repo-url>
cd dnd-game

# 2. Install dependencies
npm install

# 3. Set up local env
cp .env.example .env.local
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET, ABLY_API_KEY

# 4. Set up database
# Option A: Use Neon directly (shared dev DB)
# Option B: Local Postgres via Docker
docker run -d --name dnd-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16

# 5. Run migrations
npm run db:migrate

# 6. Start dev server
npm run dev
# → http://localhost:3000

# 7. For WebSocket testing, start Ably in dev mode
# (Ably works directly in dev, no local server needed)
```
