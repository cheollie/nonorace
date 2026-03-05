# Nonorace

Race a friend (or the clock) on nonogram puzzles. **Daily** mode: one puzzle per grid size per day, play solo and share your time. **Multiplayer**: create a room, share the link, host starts the timer — first to finish wins. No login; optional username.

---

## Why this exists

> I procrastinate often with nonograms. I am also very competitive so I wanted to find a way to beat my friends at nonograms so my time waste can be somewhat useful.

Nonorace is that: same puzzle, shared timer, winner takes the bragging rights.

---

## Features

- **Daily** — One puzzle per size (2×2, 10×10, 15×15, 20×20) per day (UTC). Date-seeded, no server storage. Copy-paste your score; state is saved in the browser per size.
- **Multiplayer 1v1** — Create a room, pick grid size, share the link. Host starts the game; everyone sees the same puzzle and timer. First to complete correctly wins. Closing the tab counts as leaving the room.
- **No account** — Optional username; player id is stored in the browser. Rooms are ephemeral (see Technical notes).

---

## Run locally

```bash
npm install
cp .env.example .env.local
# Add Pusher and Upstash env vars (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_PUSHER_KEY` | Client + server | Pusher app key (public) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Client + server | e.g. `us2`, `eu` — must match Pusher dashboard |
| `PUSHER_APP_ID` | Server | Pusher app id |
| `PUSHER_APP_KEY` | Server | Same as `NEXT_PUBLIC_PUSHER_KEY` |
| `PUSHER_SECRET` | Server | Pusher secret |
| `UPSTASH_REDIS_REST_URL` | Server | Upstash Redis REST URL (room state) |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Upstash Redis REST token |

Without **Pusher**, real-time updates (player list, game start, progress, finish) don’t sync across clients. Without **Upstash**, room state is in-memory and won’t be shared across serverless instances (see Technical notes).

### Pusher

1. Create an app at [pusher.com](https://pusher.com) (Channels).
2. Copy Key, Cluster, App ID, and Secret into `.env.local`.
3. Use the same cluster for `NEXT_PUBLIC_PUSHER_CLUSTER` and in the Pusher dashboard — mismatches break sync.

### Upstash (room state)

1. Add [Upstash Redis](https://vercel.com/integrations/upstash) (or create a DB at [upstash.com](https://upstash.com)).
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your env.  
If these are missing, the app falls back to in-memory state (fine for single-instance/local dev; broken on Vercel with multiple instances).

---

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. In **Settings → Environment Variables**, add all of the variables above (Pusher + Upstash).
3. Deploy. Upstash keeps room state consistent across serverless invocations.

---

## Technical overview

- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind. Real-time: **Pusher** (Channels). Room state: **Upstash Redis** (or in-memory fallback).
- **Room state** (host, members, game started, finished times) is stored in Redis under keys `nono:room:<roomId>`. All API routes (join, leave, start, progress, finished, state) read/write that store so every serverless instance sees the same data.
- **Host**: Only the person who created the room (link with `?host=1`) is host. They stay host until they leave; then the first remaining member becomes host. No “first joiner becomes host” — host is only set by the host link.
- **Real-time**: Join, leave, start, progress, and finish are broadcast over Pusher (`room-<roomId>`). Clients subscribe and also refetch `GET /api/room/[roomId]/state` after join and on player-join so the UI always reflects server state (single source of truth).
- **Puzzles**: Multiplayer uses a deterministic puzzle per room (seed from room id + size). Daily uses date + size; no DB, no persistence of puzzles.
- **Grid / timer**: Grid is stored in `localStorage` per room; timer and “finished” state come from the server and Pusher. On reload, the app restores grid and refetches room state.

### Room flow (multiplayer)

1. **Host** opens the create link (`/room/<id>?size=10&host=1`), confirms username, and joins. Server sets them as host and creator.
2. **Others** open the shared link (no `host=1`), confirm username, join. They appear in the host’s waiting list; they see the host and “Waiting for host to start…”
3. Host clicks **Start game**. Server sets `startedAt`, broadcasts `game-start`. Everyone’s timer and grid unlock.
4. Progress is sent to the server and broadcast so everyone can see completion %. First to finish with a correct grid wins; finish times are stored and broadcast.
5. **Leave**: Click Leave or close the tab. Server removes the member, reassigns host if needed, and broadcasts `player-left` and a full room-sync.

### API (room)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/room/[roomId]/join` | POST | Add member (body: `userId`, `username`, `host`). Returns state; server broadcasts join + host-changed + room-sync. |
| `/api/room/[roomId]/leave` | POST | Remove member (body: `userId`). Broadcasts player-left, host-changed, room-sync. |
| `/api/room/[roomId]/state` | GET | Return current room state (startedAt, hostUserId, members, finished). |
| `/api/room/[roomId]/start` | POST | Set game started (body: `userId`). Only host. Broadcasts game-start. |
| `/api/room/[roomId]/progress` | POST | Report completion % (body: `userId`, `username`, `percent`). Broadcasts progress. |
| `/api/room/[roomId]/finished` | POST | Record finish time (body: `userId`, `username`, `timeMs`). Broadcasts finished. |

---

## Room behavior

- **No “delete room”** — Rooms are just Redis keys and a Pusher channel. When everyone leaves, the host is cleared; the key can remain until overwritten or TTL (if you add one). Restarting or clearing Redis clears state.
- **Join after start** — Allowed. The client fetches `/state`, gets `startedAt`, and unlocks the timer and grid. You’re behind on time.
- **Join after everyone finished** — Allowed. You see the puzzle and can play; you’ll see others’ finish times from room state.
- **Tab close = leave** — The app sends a beacon to `/leave` on `pagehide` / `beforeunload` so others see you leave.

---

## License

MIT.
