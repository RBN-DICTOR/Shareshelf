# ShareShelf

> **Borrow what you need. Share what you have.**  
> A neighborhood circular-sharing platform that turns idle household tools, electronics, camping gear, sports equipment, and study resources into a trusted community library.

---

## Table of Contents

- [Why ShareShelf?](#why-shareshelf)
- [2-Minute Judge Walkthrough](#2-minute-judge-walkthrough)
- [Core Features](#core-features)
- [Architecture Overview](#architecture-overview)
- [Database & Integrity Model](#database--integrity-model)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Supabase Setup & Optional Chat Migration](#supabase-setup--optional-chat-migration)
- [Deploying to Vercel](#deploying-to-vercel)

---

## Why ShareShelf?

Most households own dozens of high-utility items—power drills, extension ladders, projectors, camping tents, folding chairs—that sit unused for 95% of the year, while neighbors a few streets away buy brand-new duplicates for a single weekend project.

**ShareShelf** solves this with a zero-fee, neighbor-to-neighbor borrowing workflow designed around:
1. **Hyper-local discovery** filtered directly by neighborhood, category, keyword, and live availability.
2. **Double-booking prevention** enforced at both the UI validation layer and database constraint level.
3. **Direct neighbor coordination** via an inbuilt real-time messaging drawer tied to items and borrow requests.
4. **Measurable sustainability impact** tracking reused goods and estimated community money saved.

---

## 2-Minute Judge Walkthrough

ShareShelf includes two instant demo accounts so judges can experience **both sides** of a borrow exchange without manual registration:

| Persona | Neighborhood | Role in Demo | Credentials (if typing manually) |
| :--- | :--- | :--- | :--- |
| **Alex Morgan** | `Riverside` | Item owner (drill, ladder, tent, projector, tool kit, chairs) | `alex@shareshelf.demo` / `ShareShelf!2026` |
| **Jordan Lee** | `Westlands` | Borrower & neighbor sharer (calculator, football, speaker, blender, books, pump) | `jordan@shareshelf.demo` / `ShareShelf!2026` |

### Step-by-Step Demo Flow

1. **Discover & Filter by Neighborhood**
   - On the home screen, browse the **Hero** showcase and click the **Neighborhood filter chips** (`Riverside`, `Westlands`, etc.) or **Category chips** (`Tools`, `Outdoor`, `Electronics`, etc.), or toggle **Available now**.
2. **Sign In & Message a Neighbor**
   - Click **Sign in** in the header and choose **Continue as Jordan Lee (borrower)**.
   - Open Alex's **Cordless power drill** (in `Riverside`), click **Chat with Alex**, and send a quick pickup question (or tap a one-click reply).
3. **Request to Borrow (with Date-Clash Guard)**
   - Click **Request to borrow**, pick a start and return date, add an optional note, and submit.
   - ShareShelf redirects to **My activity**, where the live **5-stage stepper** tracks: `Requested → Approved → Picked up → Returned → Complete`.
4. **Switch Personas & Complete the Loop**
   - Click Jordan's avatar in the top-right menu and select **Switch to Alex Morgan**.
   - Open the **Messages** icon in the header (unread badge updates automatically) to view Jordan's message and reply.
   - In **My activity → Incoming requests**, click **Approve** on Jordan's drill request, then open the item again to see the **Reserved dates** badge blocking overlapping requests.
   - Switch back to **Jordan Lee** → click **I picked it up** → **Request return confirmation** → switch to **Alex Morgan** → **Confirm item returned** to trigger the celebratory completion burst and watch **Impact** counters update.
5. **Create Custom PNG Artwork & Post a Want**
   - Click **Share an item** (or the center **`+`** button on mobile) to upload a real photo or switch to **Create PNG** to draw a custom item graphic on the HTML5 canvas and export/attach a real `.png` file.
   - Visit **Wanted board** to request an item not yet on the shelf or respond to an open neighbor request.

---

## Core Features

- **Neighborhood-First Discovery**: Interactive neighborhood filter strip with live item counts (automatically highlighting the signed-in user's own neighborhood first), paired with category chips, instant keyword search, and an *Available now* switch.
- **Inbuilt Neighbor Chat System**: Persistent real-time messaging drawer accessible from the top navigation bar, any item detail view (*Chat with owner*), and every borrow request card in *My activity*. Supports deterministic thread keys per item/neighbor pair, unread indicators, quick replies, and responsive mobile master-detail navigation.
- **5-Stage Borrow Lifecycle & Conflict Protection**: Strict state-machine transitions (`pending → approved → active → return_requested → completed`, plus `rejected`/`cancelled`) and reservation overlap checks via `item_busy_dates`.
- **Wanted Board**: Community request board filtered by category and neighborhood where neighbors can post needed items and reply with offers to lend.
- **Built-in PNG Studio & Real Image Uploads**: Supports drag-and-drop, clipboard paste, device file upload (`PNG`, `JPG`, `WebP`, `GIF`), or creating downloadable transparent/colored `.png` illustrations directly in the browser—zero external image URL links required.
- **Community Impact Dashboard**: Animated live metrics (*Items listed*, *Completed exchanges*, *Borrowed right now*, *Estimated money saved*, *Items reused*) and category inventory breakdown.
- **Mobile-First Ergonomics**: Thumb-friendly bottom navigation bar with raised Share action, mobile bottom-sheet modals, `44px+` touch targets, `overflow-x: clip` layout stability across 320px–430px viewports, and `prefers-reduced-motion` support.

---

## Architecture Overview

ShareShelf uses a **React 19 + TypeScript + Vite + Tailwind CSS v4** frontend engineered with a **dual-backend provider layer**:

```text
React UI (Pages, Modals, ChatDrawer, PngCreator)
   │
   ├── AuthContext (useAuth)
   ├── ShareShelfDataContext (useShareShelfData)
   └── ChatContext (useChat)
          │
          ▼
   API Abstraction (src/lib/api.ts & src/lib/chatApi.ts)
          │
          ├──► Primary Cloud Mode: Supabase
          │      • Supabase Auth (JWT sessions & demo sign-in)
          │      • PostgreSQL + Row Level Security (RLS)
          │      • Supabase Realtime (postgres_changes subscriptions)
          │      • Supabase Storage (with optimized PNG/data fallback)
          │      • Cross-tab BroadcastChannel fallback if optional
          │        chat table hasn't been migrated yet
          │
          └──► Local Full-Stack Mode: Express + Node SQLite (server/)
                 • REST endpoints (/api/items, /api/requests, /api/wants, /api/messages)
                 • Server-Sent Events (/api/events) for live updates
                 • scrypt password hashing & HMAC-signed Bearer tokens
```

For a deeper technical breakdown (state machine rules, messaging thread determinism, PNG canvas export pipeline, and security boundaries), see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Database & Integrity Model

| Entity | Purpose | Key Guarantees |
| :--- | :--- | :--- |
| `profiles` | Member name & neighborhood | Linked to authenticated user ID |
| `items` | Shared inventory & replacement value | Owner-only mutations; blocks delete while a loan is active |
| `borrow_requests` | Date-bounded loan lifecycle | `end_date >= start_date`; no self-borrowing; PostgreSQL `EXCLUDE USING gist` prevents overlapping `approved`/`active`/`return_requested` loans |
| `item_busy_dates` | Public reservation calendar view | Exposes busy date ranges without leaking private borrower details |
| `item_wants` & `want_responses` | Neighbor request board & replies | Open/fulfilled status management by requester |
| `notifications` | Real-time status & reply alerts | Triggered automatically on request/message/reply events |
| `borrow_messages` | Inbuilt neighbor chat messages | Thread-keyed by item + sorted participant IDs; participant-only RLS |
| `community_impact` | Aggregated reuse & savings view | Sums `replacement_value` across `completed` exchanges |

---

## Project Structure

```text
.
├── docs/
│   └── ARCHITECTURE.md        # Technical deep-dive for reviewers & judges
├── server/
│   ├── auth.ts                # HMAC token signing & auth middleware
│   ├── db.ts                  # SQLite schema & demo seeding
│   ├── events.ts              # Server-Sent Events (SSE) broadcaster
│   └── routes.ts              # Express REST API (/api/*)
├── src/
│   ├── assets/images/         # Bundled real photographs for demo items
│   ├── components/            # Navbar, Hero, ChatDrawer, PngCreator, Stepper, Modal, etc.
│   ├── hooks/                 # useAuth, useShareShelfData, useChat, useToast
│   ├── lib/                   # supabase.ts, api.ts, chatApi.ts, localApi.ts, format.ts
│   ├── pages/                 # DiscoverPage, WantedPage, ActivityPage, ImpactPage, ItemDetailPage
│   └── types/                 # Shared TypeScript domain interfaces
├── supabase/
│   └── chat_migration.sql     # SQL migration enabling Supabase Realtime chat table & RLS
├── server.ts                  # Unified Express + Vite dev/production entrypoint
├── vercel.json                # Vercel SPA build & rewrite configuration
└── vite.config.ts             # Vite build config
```

---

## Local Development

### Prerequisites
- **Node.js 22+** (uses built-in `node:sqlite` when running local Express mode)
- **npm** or **bun**

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables (optional)
Create a `.env` file based on `.env.example` if pointing to your own Supabase project:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### 3. Run the development server
```bash
npm run dev
```
The app runs on **`http://localhost:3000`**.

### 4. Type-check and build
```bash
npm run lint
npm run build
```

---

## Supabase Setup & Optional Chat Migration

If you connect a fresh Supabase project, run your base schema SQL plus [`supabase/chat_migration.sql`](./supabase/chat_migration.sql) in the **Supabase SQL Editor**.

`supabase/chat_migration.sql` creates:
- `public.borrow_messages` with indexes for fast thread lookup
- Row Level Security policies restricting read/write access strictly to conversation participants
- Notification trigger alerting recipients of new neighbor messages
- Publication entry in `supabase_realtime` for instant cross-device chat delivery

*(If `borrow_messages` has not been created in a Supabase instance yet, ShareShelf automatically detects `PGRST205` and falls back to cross-tab browser-synced messaging so chat continues working without errors.)*

---

## Deploying to Vercel

ShareShelf includes a ready-to-use `vercel.json`:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Routing**: SPA fallback rewrite (`/(.*) -> /index.html`) with HashRouter support

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel **Project Settings → Environment Variables** if overriding the default project configuration.
