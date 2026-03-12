# RentelX — Rental Co-Pilot for Israeli Apartment Renters

An autonomous apartment-search assistant built for renters in Israel. RentelX lets you define search profiles, ingest listings, score them against your preferences, and track your rental pipeline — all in Hebrew or English, with light and dark mode.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| Routing | React Router v6 |
| State / Data | TanStack Query v5 |
| Backend / DB | Supabase (Postgres + Auth + Edge Functions) |
| Charts | Recharts |
| Animations | Framer Motion |
| i18n | Custom LanguageContext (EN / HE, RTL support) |
| Testing | Vitest + Testing Library |
| E2E | Playwright |
| Linting | ESLint + TypeScript-ESLint |

## Features (MVP)

- **Auth** — email/password sign-up, login, password reset via Supabase Auth
- **Search Profiles** — create multiple profiles with city, price range, rooms, must-haves, and nice-to-haves
- **Listings Inbox** — manually add listings (URL or JSON paste); auto-scored on insert
- **Scoring Engine** — heuristic scoring (0–100) matching city, price, rooms, and amenities against all active search profiles
- **Pipeline** — Kanban board to track listing status: New → Contacted → Viewing → Viewed → Negotiating → Signed/Lost
- **Dashboard** — stats cards, Score Distribution chart, Pipeline Funnel, Weekly Activity chart
- **Image Gallery** — thumbnail grid + lightbox with keyboard navigation
- **Settings** — display name, language (EN/HE), theme (light/dark/system), notification preferences

## Monorepo Structure

```
/
├── src/
│   ├── components/         # React components
│   │   ├── dashboard/      # DashboardCharts
│   │   ├── layout/         # AppShell, AppSidebar, ProtectedRoute
│   │   ├── listings/       # AddListingModal, ListingCard, ImageGallery
│   │   ├── onboarding/     # OnboardingWizard steps
│   │   └── ui/             # shadcn/ui primitives
│   ├── contexts/           # AuthContext
│   ├── data/               # Static data (Israeli cities)
│   ├── hooks/              # Custom React hooks
│   ├── i18n/               # LanguageContext, ThemeContext, translations/
│   ├── integrations/       # Supabase client + generated types
│   ├── lib/                # Utility functions (scoring, utils)
│   ├── pages/              # Route-level page components
│   └── test/               # Unit test setup and suites
├── supabase/
│   ├── config.toml         # Supabase project config
│   └── functions/          # Edge Functions (ai-assist stub)
├── .github/
│   └── workflows/
│       └── ci.yml          # CI: lint + test on every PR
├── NOTES.md                # Architecture decisions & assumptions
└── CONTRIBUTING.md         # How to run the dev environment
```

## Quick Start

### Prerequisites

- Node.js ≥ 18 (use [nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```sh
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### Install & Run

```sh
npm install
npm run dev        # start dev server on http://localhost:8080
```

### Other Scripts

```sh
npm run build      # production build
npm run lint       # ESLint
npm run test       # Vitest unit tests (run once)
npm run test:watch # Vitest in watch mode
```

## Database

The schema is managed through Supabase. Key tables:

| Table | Description |
|---|---|
| `profiles` | User profile (display name, onboarding flag) |
| `search_profiles` | Renter search criteria (cities, price range, rooms, amenities) |
| `listings` | Apartment listings with metadata |
| `listing_scores` | Score of a listing against each search profile |
| `pipeline_entries` | Kanban stage per listing per user |
| `listing_notes` | Free-text notes on a listing |
| `listing_reminders` | Time-based reminders for a listing |
| `notification_preferences` | Per-user notification settings |

See `src/integrations/supabase/types.ts` for the full auto-generated TypeScript types.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Architecture Notes & Assumptions

See [NOTES.md](./NOTES.md).
