# ShareShelf Technical Architecture

This document explains ShareShelf's internal architecture, data integrity guarantees, real-time messaging pipeline, PNG canvas studio, and mobile-first responsive engineering for technical reviewers and hackathon judges.

---

## 1. System Architecture & Dual-Backend Parity

ShareShelf separates UI state from data transport through three React contexts (`AuthProvider`, `ShareShelfDataProvider`, `ChatProvider`) backed by unified client modules (`src/lib/api.ts`, `src/lib/chatApi.ts`).

### Runtime Modes

| Mode | Condition | Persistence | Real-Time Transport |
| :--- | :--- | :--- | :--- |
| **Cloud Mode (Supabase)** | Supabase URL & publishable key configured | PostgreSQL with Row Level Security (RLS) | Supabase Realtime (`postgres_changes`) |
| **Hybrid Chat Fallback** | Supabase active, `borrow_messages` table not yet migrated (`PGRST205`) | Client `localStorage` (`shareshelf_chat_messages_v1`) | Cross-tab `BroadcastChannel('shareshelf_chat_v1')` + `storage` events |
| **Local Full-Stack Mode** | No Supabase client configured (`npm run dev` local Express) | Node.js `node:sqlite` (`data/shareshelf.db`) | Express Server-Sent Events (`/api/events`) |

This ensures zero dead ends during evaluation—whether running behind Vercel static hosting with Supabase or locally via Express + SQLite.

---

## 2. Borrow Request State Machine & Date-Clash Guard

Borrowing follows a strict 5-stage lifecycle enforced both in the UI and on the backend:

```text
  [pending] ──(Owner: Approve)──► [approved] ──(Borrower: Picked up)──► [active]
      │                                │                                    │
      ├──(Owner: Decline)──► [rejected]│                                    ▼
      │                                │                          [return_requested]
      └──(Borrower: Cancel)────────────┴──► [cancelled]                     │
                                                                            ▼
                                                           (Owner: Confirm) [completed]
```

### Double-Booking Prevention
1. **Client Validation**: `ItemDetailContent.tsx` fetches `item_busy_dates` (`approved`, `active`, `return_requested`) and blocks overlapping date ranges inline before submission.
2. **Backend Enforcement**:
   - In **PostgreSQL/Supabase**: an `EXCLUDE USING gist` constraint on `(item_id WITH =, daterange(start_date, end_date, '[]') WITH &&)` rejects race-condition overlaps atomically (`23P01`), mapped cleanly by `mapSupabaseError` to `"Those dates are already reserved. Try another range."`
   - In **Express/SQLite**: `BEGIN IMMEDIATE` transactions verify date intersections before inserting or approving requests.
3. **Safe Item Deletion**: Items with `approved`, `active`, or `return_requested` loans cannot be deleted until the exchange closes.

---

## 3. Inbuilt Neighbor Chat Architecture

### Deterministic Thread Keys
To keep conversations unified whether a user initiates chat from **Discover → Item Details**, **My Activity → Borrow Request Card**, or the global **Messages Inbox**, threads share a deterministic key:

```ts
buildThreadKey(itemId, userA, userB) => `${itemId || 'direct'}::${[userA, userB].sort().join('::')}`
```

### Security & Privacy Rules
- **Participant Isolation**: Both PostgreSQL RLS (`auth.uid() = sender_id OR auth.uid() = recipient_id`) and Express `/api/messages` enforce that only the sender and recipient can read a thread.
- **Recipient-Only Read Receipts**: `markChatThreadRead` updates `is_read = true` strictly where `recipient_id` matches the authenticated user.
- **Sanitization**: All text inputs pass through `cleanText` / server-side `cleanStr` (`<` and `>` stripped, length bounded to 1,000 characters), rendered safely via React text bindings (no raw HTML injection).

### Responsive Master-Detail Drawer (`ChatDrawer.tsx`)
- **Desktop (`>= 768px`)**: Side-by-side Inbox sidebar (`w-80`) + active thread panel inside a centered `Modal`.
- **Mobile (`< 768px`)**: Bottom-sheet presentation showing either the Inbox list or the selected conversation with a sticky header, back arrow (`←`), one-tap quick replies, and keyboard-friendly composer.

---

## 4. PNG Canvas Studio (`PngCreator.tsx`)

Instead of relying on brittle external image links, ShareShelf embeds a two-layer HTML5 `<canvas>` studio (`800×600` export resolution):
1. **Background & Emblem Layer**: Dynamically renders the selected backdrop (`Warm Cream`, `Sun Soft`, `Sky Blue Soft`, `Royal Blue`, `Deep Navy`, or alpha-checked `Transparent PNG`) and category vector emblem.
2. **Offscreen Ink Layer**: Captures pointer strokes (`onPointerDown/Move/Up` with `touch-action: none`) onto a dedicated offscreen canvas so background switches, label toggles, and 25-step undo snapshots (`ImageData`) preserve user drawings cleanly.
3. **Export Pipeline**:
   - **Save `.png`**: Generates a real `image/png` Blob for download.
   - **Use this PNG**: Wraps the Blob into a `File` object and uploads to Supabase Storage (or optimizes via `fileToOptimizedImageDataUrl` / `/api/upload` fallback).

---

## 5. Mobile-First Ergonomics & Layout Stability

Targeted for `320px`–`430px` mobile screens while scaling cleanly to `1440px` desktop grids:
- **Zero Horizontal Overflow**: `overflow-x: clip` on `html` and `body` preserves `position: sticky` headers while preventing horizontal scroll bounce; multi-column form grids use `min-w-0` so native `<input type="date">` controls never stretch containers.
- **Hero Adaptation**: Renders a 2×2 card grid on `< 768px` viewports and transitions to the tilted floating showcase on `md:`+ screens.
- **Responsive Progress Stepper**: `flex-1 min-w-0` columns with proportional track positioning ensure the 5-stage borrow timeline remains crisp inside `360px` cards.
- **Thumb-Zone Navigation**: Mobile bottom navigation bar places primary destinations plus a raised central Share (`+`) action, with `pb-28` page padding and elevated toast positioning (`bottom-28`) to prevent overlap.
- **Accessibility**: Minimum `44px` interactive touch targets, semantic `aria-label` / `role="tab"` / `role="switch"` attributes, visible `:focus-visible` outlines, and `@media (prefers-reduced-motion: reduce)` / `<MotionConfig reducedMotion="user">` compliance.

---

## 6. Deployment & Static Resilience (Vercel)

- `vercel.json` configures Vite production builds (`dist/`) and SPA rewrites.
- `src/lib/localApi.ts` validates response `content-type` and JSON parsing before returning data, preventing SPA `index.html` rewrites from silently passing HTML strings into UI state.
- `AppErrorBoundary` provides a graceful recovery screen on unexpected runtime errors.
