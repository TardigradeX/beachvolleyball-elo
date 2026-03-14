# Beach Volleyball 2v2 ELO Tracker

A Firebase **Spark (free) plan** web application that tracks per-player ELO rankings for 2v2 beach volleyball tournaments.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Svelte 5 + TypeScript + Material Design CSS |
| Database | Firebase Firestore (NoSQL, free tier) |
| Auth | Firebase Authentication (Email/Password + Google) |
| Hosting | Firebase Hosting |
| Business logic | Client-side TypeScript (no Cloud Functions needed) |

All services run on the **Firebase Spark (free) plan** — no billing required.

---

## How the ELO works

- Each team's strength = **average ELO** of its two players
- Expected score = `1 / (1 + 10^((opponentTeamElo − myTeamElo) / 400))`
- Each player's delta = `K × (actualScore − expectedScore)`, K = 32
- All 4 players are updated in a single **atomic Firestore batch write** when the result is verified
- ELO floor: 100

## Match flow

```
Creator picks 3 players and creates match
             ↓
   status: pending_result
             ↓
Creator reports win or loss
             ↓
   status: pending_verification
             ↓
A team2 player confirms or disputes
             ↓
status: completed          status: disputed
             ↓
ELOs updated for all 4 players (atomic batch write)
```

### Security model (Spark plan, no Cloud Functions)

The match state machine is enforced entirely by **Firestore Security Rules**:
- Only the creator can report a result (`pending_result → pending_verification`)
- Only a team2 player can verify or dispute (`pending_verification → completed/disputed`)
- The verifier includes a `_verifyingMatchId` field with each player update — the rule reads the referenced match via `get()` to confirm the batch is legitimate
- Stats fields (`elo`, `gamesPlayed`, `wins`, `losses`) can only increase, never decrease

The ELO math itself is calculated client-side and is not server-validated (a limitation of the Spark plan without Cloud Functions). For a group-of-friends app this is acceptable.

---

## Setup Guide

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A Firebase project on the **Spark (free) plan**

---

### Step 1 — Firebase project setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project (Spark plan is fine).

2. Enable **Authentication**:
   - Console → Authentication → Sign-in method
   - Enable **Email/Password** and **Google**

3. Enable **Firestore**:
   - Console → Firestore Database → Create database
   - Choose **Production mode** (the security rules in `firestore.rules` will be deployed)
   - Pick a region close to your users

4. Register a **Web app** and copy the config values:
   - Console → Project Settings → Your apps → Add app → Web

---

### Step 2 — Configure the project

**`.firebaserc`** — replace with your project ID:
```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

**`frontend/.env.local`** — create from the example:
```bash
cp frontend/.env.example frontend/.env.local
# Fill in your Firebase config values
```

---

### Step 3 — Deploy Firestore rules and indexes

```bash
firebase login
firebase deploy --only firestore
```

This deploys `firestore.rules` (security rules) and `firestore.indexes.json` (composite indexes). The indexes may take a few minutes to build.

---

### Step 4 — Build and deploy the frontend

```bash
cd frontend
npm install
npm run build
cd ..

firebase deploy --only hosting
```

That's it — the app is live on Firebase Hosting.

---

### Development workflow

```bash
# Terminal 1 — Firebase emulators (Auth + Firestore + Hosting)
firebase emulators:start

# Terminal 2 — Vite dev server with hot reload
cd frontend
npm run dev
```

Visit http://localhost:5173 for the Vite dev server (hot reload).
The emulators UI is at http://localhost:4000.

---

## Project structure

```
beachvolley-elo/
├── firebase.json              # Firebase service config (Hosting + Firestore)
├── .firebaserc                # Project ID
├── firestore.rules            # Security rules enforcing the match state machine
├── firestore.indexes.json     # Composite indexes for efficient queries
│
└── frontend/src/
    ├── App.svelte             # Root app + hash router
    ├── firebase.ts            # Firebase SDK init (Auth + Firestore)
    ├── stores/
    │   ├── auth.ts            # Auth store + player provisioning on first login
    │   └── snackbar.ts        # Toast notification store
    ├── lib/
    │   ├── firestore/
    │   │   ├── types.ts       # TypeScript interfaces (Player, Match, etc.)
    │   │   ├── players.ts     # Firestore helpers: provision, search, leaderboard
    │   │   └── matches.ts     # Firestore helpers: create, report, verify, dispute
    │   ├── components/        # Reusable UI components (Navbar, MatchCard, etc.)
    │   └── utils/elo.ts       # ELO calculation + preview (pure TypeScript)
    └── routes/
        ├── Login.svelte       # Email/password + Google sign-in
        ├── Dashboard.svelte   # Home: profile card, match list (real-time)
        ├── CreateMatch.svelte # 3-step match builder with ELO preview
        ├── MatchDetail.svelte # Report / verify / dispute (real-time listener)
        └── Leaderboard.svelte # All players ranked by ELO
```

> **Note:** The `dataconnect/` and `functions/` directories from the initial scaffold are no longer needed and can be deleted:
> ```bash
> rm -rf dataconnect functions frontend/src/dataconnect.ts frontend/src/generated
> ```

---

## Firestore data model

### `players/{uid}`
| Field | Type | Notes |
|---|---|---|
| `uid` | string | Firebase Auth UID (same as doc ID) |
| `displayName` | string | Display name |
| `displayNameLower` | string | `displayName.toLowerCase()` — used for prefix search |
| `email` | string | |
| `photoUrl` | string \| null | |
| `elo` | number | Default: 1000 |
| `gamesPlayed` | number | |
| `wins` / `losses` | number | |
| `_verifyingMatchId` | string | Last match ID used in an ELO batch update (internal) |

### `matches/{matchId}`
| Field | Type | Notes |
|---|---|---|
| `matchId` | string | Same as doc ID |
| `team1Player1Id` … `team2Player2Id` | string | Player UIDs |
| `playerIds` | string[] | All 4 UIDs — enables `array-contains` query |
| `status` | string | `pending_result` \| `pending_verification` \| `completed` \| `disputed` |
| `reportedWinner` | string \| null | `team1` \| `team2` |
| `team1Player1EloBefore` … | number | ELO at match creation time |
| `team1Player1EloDelta` … | number \| null | ELO change after verification |
| `team1Player1` … `team2Player2` | PlayerSnapshot | Denormalized for display |

---

## Firestore free tier limits (Spark plan)

| Resource | Free limit | Expected usage |
|---|---|---|
| Reads | 50,000 / day | ~10 reads per page view |
| Writes | 20,000 / day | ~6 writes per completed match |
| Deletes | 20,000 / day | Never deleted |
| Storage | 1 GiB | ~1 KB per player, ~2 KB per match |
| Outbound network | 10 GiB / month | Minimal (Hosting serves static files) |

A group of 20 friends playing 5 matches per day uses approximately:
- ~300 writes/day (well within 20K)
- ~2,000 reads/day (well within 50K)
