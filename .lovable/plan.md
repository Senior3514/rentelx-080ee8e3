
# RentelX — Complete Product & Implementation Plan

---

## 1. Product Spec

### Problem Statement
Young renters in Israel (22–35) face a fragmented, overwhelming apartment search. Listings are scattered across Yad2, Madlan, Facebook groups, Telegram channels, and WhatsApp. No single tool aggregates, de-duplicates, scores, and guides them through the full rental pipeline. The result: missed listings, wasted viewings, decision fatigue, and lost apartments.

### Target Personas
| Persona | Age | Situation | Pain |
|---|---|---|---|
| **Noa** | 25 | First-time renter, moving to TLV for work | Overwhelmed by dozens of Facebook groups and Yad2 filters |
| **Amit** | 29 | Relocating from Haifa to Gush Dan area | Searching 3+ cities simultaneously, things fall through cracks |
| **Maya** | 27 | English-speaking olah | Can't navigate Hebrew listing sites, needs English UI |
| **Dor & Shir** | 26 | Couple searching together | Need shared pipeline so both track the same listings |

### Value Propositions
1. **One inbox for all listings** — aggregated from links, emails, Telegram, manual entry
2. **Smart scoring & de-duplication** — prioritized by preferences, duplicates merged automatically
3. **Pipeline management** — track every listing: discovery → viewing → negotiation → signed/lost
4. **Real-time alerts** — Telegram/email notifications for high-score matches
5. **Bilingual, calm UX** — Hebrew RTL + English LTR, opinionated design showing "your next step"

### Differentiators
| Feature | Yad2/Madlan | Telegram Bots | RentelX |
|---|---|---|---|
| Multi-source aggregation | ❌ | Partial | ✅ |
| De-duplication | ❌ | ❌ | ✅ |
| Personalized scoring | ❌ | ❌ | ✅ |
| Pipeline/CRM | ❌ | ❌ | ✅ |
| Bilingual UI (HE+EN) | Partial | ❌ | ✅ |
| AI-powered insights | ❌ | ❌ | ✅ |

### Primary User Journeys
1. **Onboarding** → Set preferences (cities, budget, rooms, must-haves) → system creates Search Profile(s)
2. **Ingestion** → Paste link / forward email / send Telegram message → listing appears in inbox, scored and ranked
3. **Triage** → Review scored inbox → save, dismiss, or contact listings
4. **Pipeline** → Move listing through stages (Contacted → Viewing → Viewed → Negotiating → Signed/Lost) with reminders
5. **Daily Digest** → Morning summary via Telegram/email: new matches, upcoming viewings, pending follow-ups

### MVP Out-of-Scope
- Automated scraping of Yad2/Madlan/Facebook (legal risk — Phase 2+)
- Contract/lease analysis agent
- Price benchmarking engine
- Roommate matching
- Payment/deposit management
- Native mobile apps (PWA sufficient for MVP)

---

## 2. Feature Backlog (Epics & Stories)

### Epic 1: Auth & Onboarding
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to sign up with email/Google so I can access my account | MVP | Supabase Auth with email + Google OAuth |
| As a renter, I want a guided onboarding wizard so I can set search preferences quickly | MVP | 3-step wizard: cities → budget/rooms → must-haves. Creates SearchProfile |
| As a renter, I want to choose Hebrew or English UI | MVP | Language toggle persisted; full RTL/LTR support |
| As a renter, I want to name my search profile during onboarding | MVP | Text input for profile name, saved to DB |

### Epic 2: Search Profiles
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to create multiple search profiles | MVP | CRUD for SearchProfile with city list, budget range, room count, filters |
| As a renter, I want must-have and nice-to-have criteria so listings are scored accordingly | MVP | Weighted criteria stored per profile, used by scoring engine |
| As a renter, I want to toggle profiles active/inactive | MVP | `is_active` flag controls which profiles are used for scoring |

### Epic 3: Listing Ingestion
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to paste a listing URL and have it parsed automatically | MVP | URL input → edge function extracts title, price, location, images, description |
| As a renter, I want to add a listing manually with a form | MVP | Form: address, price, rooms, sqm, description, photos, contact |
| As a renter, I want to forward listing emails and have them parsed | Phase 2 | Inbound email → edge function parses and creates listing |
| As a renter, I want to send listings to a Telegram bot | Phase 2 | Telegram bot receives link/text → creates listing |
| As a renter, I want the system to de-duplicate listings automatically | MVP | Fingerprint matching on address + price ± 5% → merge |

### Epic 4: Listings Inbox & Scoring
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want all listings in a scored, ranked inbox | MVP | List view sorted by score, filterable by city/profile/status |
| As a renter, I want each listing scored against my preferences | MVP | Score 0-100 with weighted criteria breakdown |
| As a renter, I want to quickly dismiss or save a listing | MVP | Button actions: Save, Dismiss, Contact |
| As a renter, I want listing details with photos, map, and key info | MVP | Detail page with carousel, stats grid, description |

### Epic 5: Pipeline / Board
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want a Kanban board showing pipeline stages | MVP | Columns: New → Contacted → Viewing Scheduled → Viewed → Negotiating → Signed/Lost |
| As a renter, I want to drag listings between stages | MVP | Drag-and-drop updates status, persists to DB |
| As a renter, I want to add notes and reminders to listings | MVP | Note text + optional reminder datetime |

### Epic 6: Dashboard & Analytics
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want a dashboard showing my search stats | MVP | Total listings, avg score, pipeline breakdown, recent activity |
| As a renter, I want quick actions from the dashboard | MVP | Add Listing, View Inbox, Manage Profiles buttons |

### Epic 7: Notifications & Digests
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want real-time Telegram alerts for high-score listings | Phase 2 | Listings scoring ≥80 trigger instant Telegram message |
| As a renter, I want a daily email/Telegram digest | Phase 2 | Morning summary: new matches, viewings, pending actions |
| As a renter, I want to set my notification threshold | MVP | Settings page: score threshold slider |

### Epic 8: Settings & Preferences
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to toggle dark/light mode | MVP | Theme toggle with system preference detection |
| As a renter, I want to manage notification preferences | MVP | Enable/disable email, alert threshold |
| As a renter, I want to connect my Telegram account | Phase 2 | Bot link + setup instructions |

### Epic 9: AI & Agents (Phase 2+)
| Story | Phase |
|---|---|
| As a renter, I want AI analysis of lease contracts | Phase 2 |
| As a renter, I want price benchmarking vs neighborhood average | Phase 2 |
| As a renter, I want AI to suggest which listings to prioritize | Phase 2 |

---

## 3. Architecture

### Frontend (React + Vite + Tailwind — this Lovable project)
- **Pages**: Dashboard, Onboarding Wizard, Search Profiles, Listings Inbox, Listing Detail, Pipeline Board, Settings
- **State**: React Query for server state, React Context for auth/locale/theme
- **i18n**: Context-based with `dir="rtl"` / `dir="ltr"` toggle
- **PWA**: Service worker for offline access (future)

### Backend (Supabase — Lovable Cloud)
- **Auth**: Supabase Auth (email + Google)
- **Database**: Postgres with RLS policies
- **Edge Functions**:
  - `ai-assist` — AI-powered listing analysis (exists)
  - `ingest-url` — receives URL, scrapes metadata, creates Listing
  - `score-listing` — scores a listing against SearchProfiles
  - `send-notification` — sends alerts (Phase 2)
  - `daily-digest` — scheduled morning summaries (Phase 2)
  - `telegram-bot` — receives Telegram updates (Phase 2)

### Core Data Model
```
profiles (id, display_name, avatar_url, onboarded, created_at, updated_at)
  └── search_profiles (id, user_id, name, cities[], min_price, max_price,
       min_rooms, max_rooms, must_haves[], nice_to_haves[], is_active)
  └── listings (id, user_id, source_url, address, city, price, rooms, sqm,
       floor, total_floors, description, image_urls[], amenities[],
       contact_name, contact_phone, fingerprint, status)
       └── listing_scores (id, listing_id, search_profile_id, score, breakdown{})
       └── listing_notes (id, listing_id, user_id, content)
       └── listing_reminders (id, listing_id, user_id, remind_at, message, is_done)
  └── pipeline_entries (id, listing_id, user_id, stage, entered_stage_at, notes)
  └── notification_preferences (id, user_id, email_enabled, min_score_threshold)
```

**Pipeline stages** (enum): `new` | `contacted` | `viewing_scheduled` | `viewed` | `negotiating` | `signed` | `lost`

**De-duplication**: `fingerprint` = hash of normalized(address) + price_bucket. On insert, check for existing fingerprint → merge if found.

### Integration Points (Phase 2+)
- **Contract Analysis Agent**: PDF → risk summary via edge function + LLM
- **Price Benchmarking**: neighborhood average price per sqm from historical data
- **Telegram Bot**: webhook-based listing ingestion
- **Email Parser**: inbound email → listing creation

---

## 4. UX / Screens

### Screen 1: Dashboard (Home)
- **Top**: Welcome message with user's display name
- **Stats row**: 4 cards — Total Listings, Average Score, Active Profiles, Pipeline items
- **Quick actions**: Add Listing, View Inbox, Manage Profiles (3 buttons)
- **Recent activity**: Last 5 listings added, with score badge and time-ago
- **RTL**: All cards and text flip direction; layout uses logical properties (`ms-`, `me-`)

### Screen 2: Onboarding Wizard
- **Step 1 — Profile Name + Cities**: Text input for name, multi-select chips for Israeli cities with search
- **Step 2 — Budget & Size**: Two range sliders (price ₪, rooms). Optional: sqm, floor
- **Step 3 — Must-Haves**: Checkbox grid: parking, elevator, balcony, pets, AC, storage, furnished. Toggle must-have vs nice-to-have
- **CTA**: "Start Finding Apartments" → creates profile, redirects to Dashboard

### Screen 3: Listings Inbox
- **Layout**: Card list sorted by score, with filters for city/profile/status
- **Each card**: Score badge (color-coded), address, price, rooms, city, amenities count, time-ago. Quick actions: ♥ Save, ✕ Dismiss
- **Top bar**: Filter pills, sort toggle, "Add Listing" button
- **Empty state**: Illustration + 3 ways to add listings

### Screen 4: Listing Detail
- **Top**: Image carousel (full-width mobile), back button
- **Body**: Score breakdown bar, key stats grid (price, rooms, sqm, floor), address, description
- **Actions bar (sticky bottom)**: "Move to Pipeline", "Call Landlord", "Add Note", "Dismiss"
- **Side panel (desktop)**: Notes list + reminder scheduler

### Screen 5: Pipeline Board
- **Kanban layout**: 7 columns (New | Contacted | Viewing Scheduled | Viewed | Negotiating | Signed | Lost)
- **Cards**: Mini listing card with title, price, score, days in stage. Drag to move
- **Mobile**: Grouped list view by stage

### Screen 6: Search Profiles
- **List of profile cards** with name, cities, budget summary, listing count, active toggle
- **Edit**: Opens wizard pre-filled
- **"+ New Profile"** button

### Screen 7: Settings
- **Sections**: Account, Language (HE/EN toggle), Theme (Light/Dark/System), Notifications (email toggle, threshold slider)
- **Future**: Telegram connection, connected accounts

### RTL/LTR & Theming
- `dir` attribute on `<html>` switches based on language
- Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) instead of `ml-`/`mr-`
- CSS variables for all colors via `index.css` design tokens
- Dark mode via `class="dark"` on `<html>`

---

## 5. Implementation Task Plan

> **Note**: This project uses **React + Vite + Tailwind** (Lovable) with **Supabase** (Lovable Cloud). Not Next.js/NestJS.

### Current Status (Completed)
- ✅ Supabase schema (all tables, RLS policies, enums)
- ✅ Auth flow (email + password, login/signup/reset)
- ✅ i18n system (HE/EN with RTL/LTR)
- ✅ Dark/light theme toggle
- ✅ Onboarding wizard (3 steps + profile name)
- ✅ Listings Inbox with scoring, filters, sort
- ✅ Listing Detail page
- ✅ Add Listing modal (manual form)
- ✅ Pipeline Board (Kanban with drag-drop)
- ✅ Search Profiles CRUD
- ✅ Settings page
- ✅ Dashboard with stats and quick actions
- ✅ AI-assist edge function
- ✅ Rebranding to RentelX

### Next Tasks (Priority Order)

#### Phase 1: Polish & Hardening
1. **Add URL ingestion edge function** — Accept URL, use Firecrawl to scrape listing data, normalize and store. Done = pasting a URL creates a parsed listing.
2. **Implement listing scoring edge function** — Score listing against all active SearchProfiles on insert. Done = each new listing gets auto-scored.
3. **Add real-time score updates** — When a SearchProfile changes, re-score all listings. Done = editing profile updates scores.
4. **Add listing image upload** — Allow users to upload photos when adding listings manually. Done = images stored in Supabase Storage, URLs saved.
5. **Add Google OAuth** — Enable Google sign-in alongside email/password. Done = user can sign in with Google.
6. **Add listing sharing** — Share a listing detail page via URL. Done = shareable public link.
7. **Mobile responsive polish** — Ensure all screens work on 375px+. Done = full mobile usability.
8. **Empty states & onboarding prompts** — Illustrations and guidance for empty inbox, no profiles. Done = clear guidance everywhere.
9. **Error handling & loading states** — Skeleton loaders, error boundaries, toast notifications. Done = no unhandled errors.
10. **PWA setup** — Service worker, manifest, install prompt. Done = app installable on mobile.

#### Phase 2: Integrations & Intelligence
11. **Telegram bot integration** — Edge function for webhook, user links account in Settings. Done = send link to bot → listing appears.
12. **Email ingestion** — Inbound email parsing edge function. Done = forwarded email creates listing.
13. **Real-time Telegram alerts** — High-score listings trigger Telegram notification. Done = instant alert for score ≥80.
14. **Daily digest** — Scheduled edge function for morning summary. Done = daily Telegram/email digest.
15. **AI contract analysis** — Upload PDF, get risk summary. Done = basic lease analysis.
16. **Price benchmarking** — Compare listing price to neighborhood averages. Done = price context on detail page.
17. **Map view for inbox** — Toggle between list and map view. Done = listings plotted on map.
18. **Shared pipelines** — Multiple users share a pipeline (couples). Done = invite by email, shared board.

#### Phase 3: Growth & Automation
19. **Automated source scanning** — Scheduled checks of permitted listing APIs. Done = new listings auto-ingested.
20. **Smart recommendations** — AI suggests which listings to prioritize. Done = "recommended" badge.
21. **Viewing scheduler** — Calendar integration for scheduling viewings. Done = sync with Google Calendar.
22. **Landlord communication log** — Track calls, messages, responses. Done = communication history per listing.
23. **Analytics dashboard** — Search trends, market insights. Done = charts showing market data.
