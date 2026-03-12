# RentelX — AI Rental Co-Pilot

> Israel's most advanced AI-powered apartment-hunting platform.
> Target: Tel Aviv · Givatayim · Ramat Gan (Gush Dan)

---

## Quick Reference

```bash
npm run dev          # Dev server (localhost:8080)
npm run build        # Production build
npm run lint         # ESLint (0 errors required for CI)
npm test             # Vitest unit tests (9 tests)
npx tsc --noEmit     # TypeScript strict check
```

---

## Architecture

```
React 18 + Vite 5 + TypeScript 5.8
├── UI: shadcn/ui + Radix + Tailwind 3.4 (glass-morphism design)
├── Animation: Framer Motion 12 (spring physics, AnimatePresence, useInView)
├── State: TanStack Query v5 (server), Zustand-free (local useState)
├── Auth: Supabase Auth (email + magic link)
├── DB: Supabase PostgreSQL with Row-Level Security
├── i18n: Custom (EN/HE, RTL/LTR, Rubik font for Hebrew)
└── AI: OpenRouter → Claude 3 Haiku (via edge function)
```

### Key Directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Route-level page components |
| `src/components/layout/` | AppShell (layout + page transitions) + AppSidebar |
| `src/components/listings/` | ListingCard, AddListingModal, ImageGallery |
| `src/components/dashboard/` | DashboardCharts, NeighborhoodInsights |
| `src/components/ui/` | shadcn/ui primitives + AnimatedCounter, ScoreRing |
| `src/lib/` | rateLimit, sanitize, yad2, scanService |
| `src/i18n/` | LanguageContext, translations/en.json, translations/he.json |
| `supabase/functions/` | ai-assist (OpenRouter), scan-yad2 (Yad2 proxy) |

---

## Pages & Routes

| Route | Page | Auth |
|-------|------|------|
| `/` | Landing | Public |
| `/login` | Login (rate-limited) | Public |
| `/signup` | Signup (rate-limited) | Public |
| `/dashboard` | Dashboard + Analytics | Protected |
| `/inbox` | Listings Inbox (filter/sort/export) | Protected |
| `/listings/:id` | Listing Detail + AI Analysis | Protected |
| `/pipeline` | Kanban Pipeline (drag & drop) | Protected |
| `/watchlist` | Auto-Scan Watchlist (Yad2 real-time) | Protected |
| `/compare` | Side-by-side Listing Comparison | Protected |
| `/profiles` | Search Profiles | Protected |
| `/settings` | Account + Notifications | Protected |

---

## Data Model (Supabase)

```sql
listings          -- user's saved apartments (address, price, rooms, sqm, score…)
listing_scores    -- AI scores (0-100) with breakdown JSON
listing_notes     -- free-text notes per listing
listing_reminders -- scheduled reminders per listing
pipeline_entries  -- kanban stage tracking (new→signed)
search_profiles   -- user preferences (cities, budget, rooms, amenities)
profiles          -- user display_name, settings
```

---

## Feature Map

### Core (working)
- ✅ Multi-source listing ingestion (URL paste → AI extract, manual, Yad2 scan)
- ✅ AI scoring 0–100 (price, location, rooms, amenities vs. profile)
- ✅ Score breakdown bars in card + SVG score rings
- ✅ Kanban pipeline: 7 stages, drag-and-drop, spring animations
- ✅ Dashboard with animated counters, recharts, weekly activity
- ✅ RTL/LTR full support (logical CSS, flip-rtl icons, Rubik Hebrew font)
- ✅ Rate-limited login/signup (5 attempts / 5-min window)
- ✅ XSS / open-redirect / injection protection (src/lib/sanitize.ts)
- ✅ Unified auth error messages (no user enumeration)

### Watchlist & Scanning
- ✅ Real-time Yad2 scan via Edge Function (TLV / Givatayim / Ramat Gan)
- ✅ Auto-scan every 5 min toggle
- ✅ Client-side match scoring vs. active search profile
- ✅ One-tap "Save to Inbox" import from scan results
- ✅ Cover image, amenities, floor/total-floors display

### Intelligence
- ✅ AI Chat bubble (floating, powered by ai-assist edge function)
- ✅ Neighborhood market insights (median prices, trends)
- ✅ Side-by-side listing comparison (/compare)
- ✅ CSV export from Inbox

### i18n
- All keys in `en.json` and `he.json` — never hardcode strings
- Use `t("section.key")` via `useLanguage()`
- RTL layout: use logical CSS (`ms-`, `me-`, `ps-`, `pe-`) never `ml-`/`mr-`
- Directional icons: add `flip-rtl` class to `<ArrowLeft />`, `<ChevronRight />`

---

## Edge Functions

### `scan-yad2`
Proxies Yad2 REST API. Bypass browser CORS.
```ts
// POST body
{ cities: ["tel-aviv","givatayim","ramat-gan"], minPrice?, maxPrice?, minRooms?, maxRooms? }
// Response
{ listings: ScannedListing[], fetchedAt: string }
```

### `ai-assist`
OpenRouter → Claude 3 Haiku.
```ts
// POST body
{ messages: ChatMessage[], type: "chat" | "analyze" | "summarize" }
// Response
{ content: string }
```

---

## Security Rules
1. **Never** commit `.env` / secrets
2. Rate-limit all auth forms (see `src/lib/rateLimit.ts`)
3. Sanitize all user text inputs (see `src/lib/sanitize.ts`)
4. Use `safeRedirectPath()` before any navigation based on user input
5. Supabase RLS enabled on all tables — queries scoped by `user_id`
6. `@typescript-eslint/no-explicit-any` = warning (Supabase generics); fix with proper types where possible

---

## Animation Conventions
- Page transitions: AnimatePresence mode="wait" in AppShell
- Stagger lists: `container/item` variants with `staggerChildren: 0.07`
- Cards: `whileHover={{ y: -2 }}` spring
- Counters: `useSpring` + `useMotionValue` (src/components/ui/animated-counter.tsx)
- New keyframes: float, beam, node-pulse, gradient-shift, shimmer, scan, sparkle (tailwind.config.ts)

---

## CI / CD
- **Branch**: `claude/platform-e2e-upgrade-nPLVg` → PR → `main`
- **CI checks**: ESLint (0 errors) + Vitest (9 tests) → then Build
- Push: `git push -u origin claude/platform-e2e-upgrade-nPLVg`
