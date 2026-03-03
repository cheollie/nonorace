# Nonogram 1v1

Race a friend in a nonogram puzzle. Create a room, pick grid size (10×10, 15×15, 20×20), share the link. First to finish wins. No login; optional username.

## Run locally

```bash
npm install
cp .env.example .env.local
# Fill in Pusher keys (see below)
npm run dev
```

## Deploy on Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add environment variables in Vercel (Settings → Environment Variables):
   - `NEXT_PUBLIC_PUSHER_KEY`
   - `NEXT_PUBLIC_PUSHER_CLUSTER` (e.g. `us2`)
   - `PUSHER_APP_ID`
   - `PUSHER_APP_KEY` (same as `NEXT_PUBLIC_PUSHER_KEY`)
   - `PUSHER_SECRET`

## Pusher setup

1. Go to [pusher.com](https://pusher.com) and create a Channels app.
2. Copy **Key**, **Cluster** (e.g. `us2`, `eu`, `ap1`), **App ID**, and **Secret** from the dashboard into `.env.local`.
3. Set **NEXT_PUBLIC_PUSHER_CLUSTER** and **PUSHER_CLUSTER** to the exact cluster shown in the dashboard — if they don’t match, the player list and “Start game” won’t sync across browsers.

Without Pusher the host can still start (they use the API response), but other players won’t see the start or see who joined.

## Room flow

- **Host** creates a room (link includes `host=1`). They see the list of players in the room and a **Start game** button. The shared timer starts when the host clicks Start.
- **Others** join via the shared link (no `host=1`). They see “Waiting for host to start…” until the host starts. Everyone shares the same timer and the same puzzle; first to finish wins. More than two people can be in a room.

## Room behavior

- **Deleting rooms** — There is no “delete room” action. Rooms are not stored in a database; they’re just a Pusher channel and an in-memory “has this game started?” state on the server. When everyone leaves, the channel goes idle. The server keeps the start time in memory for a while so late joiners can still load the game; that state is not explicitly cleared (and is lost on server restart or in serverless, per instance).

- **Joining after the game has started** — Yes. When you open the room link after the host has clicked Start, the page fetches the room’s start time from the API. Your timer and grid unlock so you can play. You’ll be behind everyone else time-wise; the shared timer is based on when the host started.

- **Joining after everyone has finished** — Yes, the link still works. You’ll get the same start time from the API, so you’ll see the grid and timer. You can still play the puzzle; you’ll also see other players’ progress/finish times as they’re in the room (via Pusher). If you’re the only one left, you’ll just see yourself. There is no “room closed” or lockout once the game is over.

## Later (not implemented)

- **Async mode**: play the same puzzle on your own time; each person gets a unique link and their time is recorded. Compare times later without needing to be in the room at the same time.
