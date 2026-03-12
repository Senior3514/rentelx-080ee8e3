# Architecture Notes & Decisions

This file documents the key architectural decisions, assumptions, and future-work markers for the RentelX "Rental Co-Pilot" project.

---

## 1. Stack Choices vs. Original Spec

The original product spec called for:
- **Frontend**: Next.js + React (TypeScript)
- **Backend**: NestJS (Node.js) or FastAPI (Python)
- **Database**: Postgres
- **Hosting**: GitHub monorepo + Claude Code + Lovable

**What was actually built (Phase 0 / MVP via Lovable):**

| Spec | Actual | Reason |
|---|---|---|
| Next.js | Vite + React 18 | Lovable's default stack; faster iteration for SPA |
| NestJS / FastAPI | Supabase Edge Functions (Deno/TypeScript) | Lovable's managed backend removes infra overhead for MVP |
| Postgres (self-managed) | Supabase Postgres (managed) | Same engine, production-grade managed service with row-level security |
| Separate API service | Supabase client-side queries + Edge Functions | Sufficient for MVP; adds a dedicated API layer in Phase 2 if needed |

**Migration path**: If a dedicated NestJS or FastAPI service becomes necessary (e.g., complex agent orchestration, Firecrawl integration, Telegram bot webhook), it can be added as `apps/api/` in a monorepo layout without touching the existing frontend.

---

## 2. Authentication

- Uses **Supabase Auth** (email/password + magic-link capable).
- Auth state is managed via `AuthContext` (`src/contexts/AuthContext.tsx`).
- All app routes are protected behind `ProtectedRoute`; unauthenticated users see the Landing page.
- **TODO (Phase 2)**: Add Google / Apple OAuth providers via Supabase dashboard.

---

## 3. Data Model

The schema lives in Supabase and is reflected in `src/integrations/supabase/types.ts`.

### Key Design Decisions

- **`listings.status`** is a free-text field (default `"active"`); pipeline state is tracked separately in `pipeline_entries.stage` (typed enum). This allows a listing to appear in the inbox independent of pipeline stage.
- **`listing_scores`** is a separate table (1-to-many per listing × search profile), enabling multi-profile scoring without denormalising the listing row.
- **`listing.fingerprint`** — reserved for future deduplication: a hash of address + price + rooms. Currently not populated by MVP ingestion.
- **`profiles.onboarded`** flag drives the onboarding redirect (`/onboarding`).

### TODO: Missing Entities (Future Phases)
- `tasks` / `reminders` — basic model exists (`listing_reminders`), but a general task manager is in Phase 2.
- `listing_interactions` — track call log, email threads (Phase 2).
- `contract_analysis` — AI-powered clause extraction (Phase 3).
- `price_benchmarks` — neighbourhood price data (Phase 3).

---

## 4. Scoring Engine

Location: `src/lib/scoring.ts`

A deterministic heuristic scoring function (0–100) with four weighted components:

| Component | Weight | Logic |
|---|---|---|
| City match | 30% | Binary: 100 if listing city ∈ profile.cities, else 0 |
| Price match | 30% | 100 if in range; linear decay outside range |
| Rooms match | 20% | 100 if in range; -33 per room outside range |
| Amenities | 20% | Weighted hit-rate of must-haves (×2) + nice-to-haves |

**TODO (Phase 2 / AI extension)**: Replace or augment with an LLM-based scoring call (Claude API) that can parse free-text descriptions and score soft attributes like "natural light", "quiet street", "renovated kitchen".

Scoring is triggered automatically on listing insert inside `AddListingModal` (calls `scoreListing()` against all active search profiles and writes rows to `listing_scores`).

---

## 5. Listing Ingestion

Currently: **manual only** — user pastes data into the `AddListingModal` form.

**TODO (Phase 1)**: Connect [Firecrawl](https://firecrawl.dev) URL parser:
- User pastes a Yad2 / Madlan URL.
- Backend Edge Function calls Firecrawl API to extract structured listing data.
- Firecrawl connector was scaffolded but deferred (Firecrawl API key required).

**TODO (Phase 2)**:
- Telegram bot ingestion (user forwards a message/link → parsed & inserted).
- Email forwarding ingestion (user forwards an email → parsed & inserted).
- Cron-based scanning of public listing feeds where ToS permits.

---

## 6. Internationalisation (i18n)

- Custom `LanguageContext` (`src/i18n/LanguageContext.tsx`) stores `"en"` or `"he"`, persisted to `localStorage`.
- Translation strings in `src/i18n/translations/en.json` and `he.json`.
- RTL support: `<html dir="rtl">` is toggled on language switch.
- **No i18n library** (e.g., i18next) is used — the simple JSON + context pattern is intentional for MVP; migrate if string count grows significantly.

---

## 7. Theme

- `ThemeContext` (`src/i18n/ThemeContext.tsx`) provides light / dark / system, persisted to `localStorage`.
- Uses Tailwind CSS `dark:` variants + CSS custom properties.
- `next-themes` is a dependency but the custom context was preferred for tighter control.

---

## 8. Future Agent Integration Points

Marked with `// TODO(agent):` comments in the codebase:

| Location | Agent | Purpose |
|---|---|---|
| `src/lib/scoring.ts` | Scoring Agent | Replace heuristic with Claude-powered semantic scoring |
| `supabase/functions/ai-assist/` | AI Assist | Copilot suggestions on listing detail page |
| `src/components/listings/AddListingModal.tsx` | Ingestion Agent | Auto-parse URL via Firecrawl / LLM extraction |
| `src/pages/ListingDetail.tsx` | Contract Agent | Analyse uploaded lease contract |
| `src/pages/Settings.tsx` | Notification Agent | Send email/Telegram digest of new high-score listings |

---

## 9. CI / Deployment

- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — runs ESLint + Vitest on every PR.
- **Deployment**: Lovable's built-in publish for rapid previews; long-term target is Vercel (frontend) + Supabase (backend).

---

## 10. Known Limitations (MVP)

1. No server-side rendering — pure SPA; SEO is not a requirement for this app.
2. No rate limiting on listing ingestion.
3. Firecrawl and Telegram integrations are stubs — require external API keys.
4. No email notification sending yet (notification_preferences table exists but no Edge Function sends emails).
5. `listing.fingerprint` deduplication is not yet computed on insert.
