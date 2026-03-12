

# Rental Co-Pilot — Product & Implementation Plan

## 1. Product Spec

### Problem Statement
Young renters in Israel (ages 22–35) face a fragmented, chaotic apartment search: listings are scattered across Yad2, Madlan, Facebook groups, Telegram channels, and WhatsApp. There's no single tool that aggregates, de-duplicates, scores, and guides them through the full rental pipeline. The result is missed listings, wasted viewings, and decision fatigue.

### Target Personas
- **Noa (25)** — First-time renter moving to Tel Aviv for work. Overwhelmed by dozens of Facebook groups and Yad2 filters. Wants someone to "watch the market" for her.
- **Amit (29)** — Experienced renter relocating from Haifa to the Gush Dan area. Searching across 3+ cities simultaneously. Wants a pipeline view so nothing falls through the cracks.
- **International transplant (27)** — English-speaking oleh/olah. Needs English UI and doesn't know how to navigate Hebrew listing sites.

### Value Propositions
1. **One inbox for all listings** — aggregated from links, emails, Telegram, and manual entry.
2. **Smart scoring & de-duplication** — prioritized by your preferences, duplicates merged automatically.
3. **Pipeline management** — track every listing from discovery → viewing → negotiation → signed/lost.
4. **Real-time alerts** — Telegram/email notifications for high-score matches.
5. **Bilingual, calm UX** — Hebrew RTL + English LTR, opinionated design that always shows "your next step."

### Differentiators vs. Existing Tools
| Feature | Yad2/Madlan | Telegram Bots | Rental Co-Pilot |
|---|---|---|---|
| Multi-source aggregation | ❌ | Partial | ✅ |
| De-duplication | ❌ | ❌ | ✅ |
| Personalized scoring | ❌ | ❌ | ✅ |
| Pipeline/CRM | ❌ | ❌ | ✅ |
| Bilingual UI | Partial | ❌ | ✅ |

### Primary User Journeys
1. **Onboarding** → User sets preferences (cities, budget, rooms, must-haves) → system creates Search Profile(s).
2. **Ingestion** → User pastes a link / forwards an email / sends a Telegram message → listing appears in inbox, scored and ranked.
3. **Triage** → User reviews scored inbox → swipes/clicks to advance, dismiss, or save listings.
4. **Pipeline** → User moves listing through stages (Contacted → Viewing Scheduled → Viewed → Negotiating → Signed/Lost) with reminders.
5. **Daily Digest** → System sends morning summary via Telegram/email: new matches, upcoming viewings, pending follow-ups.

### MVP Out-of-Scope
- Automated scraping of Yad2/Madlan/Facebook (legal risk — Phase 2+).
- Contract/lease analysis agent.
- Price benchmarking engine.
- Roommate matching.
- Payment/deposit management.
- Native mobile apps (PWA is sufficient for MVP).

---

## 2. Feature Backlog

### Epic 1: Auth & Onboarding
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to sign up with email/Google so I can access my account | MVP | Supabase Auth with email + Google OAuth working |
| As a renter, I want a guided onboarding wizard so I can set my search preferences quickly | MVP | 3-step wizard: cities → budget/rooms → must-haves. Creates SearchProfile on completion |
| As a renter, I want to choose Hebrew or English UI | MVP | Language toggle persisted to user profile; full RTL/LTR support |

### Epic 2: Search Profiles
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to create multiple search profiles (e.g. "TLV solo" + "Gush Dan with partner") | MVP | CRUD for SearchProfile with city list, budget range, room count, filters |
| As a renter, I want to set "must-have" and "nice-to-have" criteria so listings are scored accordingly | MVP | Weighted criteria stored per profile, used by scoring engine |

### Epic 3: Listing Ingestion
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to paste a listing URL and have it parsed automatically | MVP | URL input → edge function extracts title, price, location, images, description |
| As a renter, I want to forward listing emails and have them parsed | MVP | Dedicated inbound email address → edge function parses and creates listing |
| As a renter, I want to send listings to a Telegram bot | MVP | Telegram bot receives link/text → creates listing |
| As a renter, I want to add a listing manually with a form | MVP | Form with fields: address, price, rooms, sqm, description, photos, contact |
| As a renter, I want the system to de-duplicate listings automatically | MVP | Matching on address + price ± 5% + similar description → merge |

### Epic 4: Listings Inbox & Scoring
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to see all my listings in a scored, ranked inbox | MVP | List view sorted by score, with filters for city/profile/status |
| As a renter, I want each listing scored against my preferences | MVP | Score 0-100 based on weighted criteria match |
| As a renter, I want to quickly dismiss or save a listing | MVP | Swipe/button actions: Save, Dismiss, Contact |
| As a renter, I want to see listing details with photos, map, and key info | MVP | Detail page with image carousel, map pin, structured data, raw description |

### Epic 5: Pipeline / Board
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want a Kanban board showing my pipeline stages | MVP | Columns: New → Contacted → Viewing Scheduled → Viewed → Negotiating → Signed / Lost |
| As a renter, I want to drag listings between stages | MVP | Drag-and-drop updates status |
| As a renter, I want to add notes and reminders to listings | MVP | Note text + optional reminder datetime → notification triggered |

### Epic 6: Notifications & Digests
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want real-time Telegram alerts for high-score new listings | MVP | Listings scoring ≥80 trigger instant Telegram message |
| As a renter, I want a daily email/Telegram digest | Phase 2 | Morning summary: new matches, today's viewings, pending actions |

### Epic 7: Settings & Preferences
| Story | Phase | Acceptance Criteria |
|---|---|---|
| As a renter, I want to toggle dark/light mode | MVP | Theme toggle with system preference detection |
| As a renter, I want to manage notification preferences | MVP | Settings page: enable/disable Telegram, email, alert threshold |

### Epic 8: Future Agents (Phase 2+)
| Story | Phase |
|---|---|
| As a renter, I want AI analysis of lease contracts | Phase 2 |
| As a renter, I want price benchmarking for a listing vs. neighborhood average | Phase 2 |
| As a renter, I want automated scraping of Yad2/Madlan | Phase 2 |

---

## 3. Architecture

### Frontend (React + Vite + Tailwind — this Lovable project)
- **Pages**: Onboarding Wizard, Search Profiles, Listings Inbox, Listing Detail, Pipeline Board, Settings
- **State**: React Query for server state, React Context for auth/locale/theme
- **i18n**: Simple context-based with `dir="rtl"` / `dir="ltr"` toggle
- **PWA**: Service worker for offline access and push notifications

### Backend (Supabase — Lovable Cloud)
- **Auth**: Supabase Auth (email + Google)
- **Database**: Postgres via Supabase
- **Edge Functions**:
  - `ingest-url` — receives URL, scrapes metadata via Firecrawl, creates Listing
  - `ingest-email` — parses forwarded email, extracts listing data
  - `telegram-bot` — receives Telegram updates, creates Listings
  - `score-listing` — scores a listing against user's SearchProfiles
  - `send-notification` — sends Telegram/email alerts
  - `daily-digest` — scheduled function for morning summaries

### Core Data Model
```
User (id, email, name, language, theme, created_at)
  └── SearchProfile (id, user_id, name, cities[], min_price, max_price, 
       min_rooms, max_rooms, must_haves[], nice_to_haves[], weights{})
  └── Listing (id, user_id, source, source_url, title, description,
       address, city, neighborhood, price, rooms, sqm, floor,
       images[], contact_name, contact_phone, raw_data{},
       fingerprint, status, created_at)
       └── ListingScore (id, listing_id, profile_id, score, breakdown{})
       └── ListingNote (id, listing_id, text, created_at)
       └── ListingReminder (id, listing_id, remind_at, message, sent)
  └── PipelineEntry (id, listing_id, user_id, stage, moved_at)
  └── NotificationPreference (id, user_id, channel, enabled, threshold)
```

**De-duplication**: `fingerprint` = hash of normalized(address) + price_bucket. On insert, check for existing fingerprint → merge if found.

### Integration Points (Phase 2)
- **Contract Analysis Agent**: receives PDF → returns risk summary (via edge function + LLM)
- **Price Benchmarking**: neighborhood average price per sqm from historical data
- **Scraping Workers**: scheduled edge functions that poll Yad2/Madlan APIs (where legally permitted)

---

## 4. UX / Screens

### Screen 1: Onboarding Wizard
- **Step 1 — Cities**: Multi-select chips for Israeli cities (Tel Aviv, Jerusalem, Haifa, etc.) with search. "Search across multiple cities at once."
- **Step 2 — Budget & Size**: Two range sliders (price ₪, rooms). Optional: sqm, floor preference.
- **Step 3 — Must-Haves**: Checkbox grid: parking, elevator, balcony, pets allowed, AC, storage, furnished. Toggle must-have vs nice-to-have.
- **CTA**: "Start Finding Apartments" → creates profile, lands on empty Inbox with ingestion prompts.

### Screen 2: Listings Inbox
- **Layout**: Left sidebar with search profiles as tabs. Main area is a card list sorted by score.
- **Each card**: Score badge (color-coded), thumbnail, title/address, price, rooms, city, source icon, time ago. Quick actions: ♥ Save, ✕ Dismiss, 📞 Contact.
- **Top bar**: Filter pills (city, price range, score threshold), sort toggle, "Add Listing" button (paste URL, manual entry).
- **Empty state**: Friendly illustration + 3 ways to add listings (paste link, forward email, Telegram bot instructions).

### Screen 3: Listing Detail
- **Top**: Image carousel (full-width on mobile). Back button.
- **Body**: Score breakdown bar, key stats grid (price, rooms, sqm, floor), address with map embed, full description (Hebrew text with proper RTL).
- **Actions bar (sticky bottom)**: "Move to Pipeline", "Call Landlord", "Add Note", "Dismiss".
- **Side panel (desktop)**: Notes list + reminder scheduler.

### Screen 4: Pipeline Board
- **Kanban layout**: 6 columns (New | Contacted | Viewing Scheduled | Viewed | Negotiating | Signed/Lost).
- **Cards**: Mini listing card with title, price, score, days in stage. Drag to move.
- **Mobile**: Horizontal scrollable columns or list view grouped by stage.
- **Top**: "Upcoming" section showing today's viewings and pending reminders.

### Screen 5: Search Profiles
- **List of profile cards** with name, cities, budget summary, listing count.
- **Edit**: Opens the same wizard flow pre-filled.
- **"+ New Profile"** button.

### Screen 6: Settings
- **Sections**: Account, Language (Hebrew/English toggle), Theme (Light/Dark/System), Notifications (Telegram link, email toggle, score threshold slider), Connected Accounts.
- **Telegram Setup**: "Connect Telegram" → shows bot link + instructions.

### RTL/LTR & Theming
- `dir` attribute on `<html>` switches based on language.
- Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) instead of `ml-`/`mr-`.
- CSS variables for all colors (already set up in this project's `index.css`).

---

## 5. Implementation Task Plan

> **Note on tech stack**: Since this is a Lovable project, the frontend uses **React + Vite + Tailwind** (not Next.js), and the backend uses **Supabase** (Lovable Cloud) instead of NestJS/FastAPI. This is the optimal path for rapid development.

### Phase 0: Foundation (Tasks 1–8)
1. **Set up Supabase schema** — Create tables: users profile, search_profiles, listings, listing_scores, listing_notes, listing_reminders, pipeline_entries, notification_preferences. Done = all tables created with RLS policies.
2. **Implement auth flow** — Supabase Auth with email + Google. Login/signup pages. Done = user can register, login, logout.
3. **Add i18n system** — React context for language (he/en), direction (rtl/ltr). Translation JSON files. Done = UI switches between Hebrew RTL and English LTR.
4. **Add dark/light theme** — Theme toggle using existing CSS variables + `next-themes`. Done = theme persists across sessions.
5. **Build onboarding wizard** — 3-step form (cities, budget, must-haves). Creates SearchProfile in DB. Done = new user completes wizard, profile saved.
6. **Build Search Profiles CRUD page** — List, create, edit, delete profiles. Done = user manages multiple profiles.
7. **Build Listings Inbox page** — Card list with score badge, filters, sort. Done = listings display sorted by score with filter controls.
8. **Build Listing Detail page** — Image carousel, stats grid, description, map placeholder, notes. Done = full listing info displayed with actions.

### Phase 1: Ingestion & Scoring (Tasks 9–15)
9. **Create URL ingestion edge function** — Accepts URL, uses Firecrawl to scrape listing data, normalizes and stores. Done = pasting a Yad2/Madlan link creates a parsed listing.
10. **Build "Add Listing" UI** — Modal with URL paste input + manual form fallback. Done = user can add listings via URL or manual entry.
11. **Implement listing scoring engine** — Edge function that scores listing against SearchProfile criteria. Done = each listing gets a 0-100 score with breakdown.
12. **Implement de-duplication** — Fingerprint generation on insert, merge logic for duplicates. Done = duplicate URLs/addresses are caught and merged.
13. **Set up Telegram bot** — Connect Telegram connector, edge function for `getUpdates`, parse forwarded listings. Done = user sends link to bot → listing appears in inbox.
14. **Build email ingestion** — Inbound email parsing edge function. Done = forwarded listing email creates a listing.
15. **Implement real-time Telegram alerts** — High-score listings trigger Telegram notification via bot. Done = user gets Telegram message for listings scoring ≥80.

### Phase 2: Pipeline & Polish (Tasks 16–22)
16. **Build Pipeline Board page** — Kanban with drag-and-drop (6 stages). Done = user drags listings between stages, state persists.
17. **Add notes & reminders to listings** — Note input + reminder datetime picker with notification trigger. Done = notes saved, reminders fire as Telegram/email.
18. **Build Settings page** — Language, theme, notification preferences, Telegram connection. Done = all settings functional and persisted.
19. **Add daily digest** — Scheduled edge function sending morning summary. Done = user receives daily Telegram/email digest.
20. **Mobile responsive polish** — Ensure all screens work on mobile (375px+). Pipeline becomes scrollable/list view. Done = full mobile usability.
21. **Empty states & onboarding prompts** — Friendly illustrations and guidance for empty inbox, no profiles, etc. Done = new users have clear guidance everywhere.
22. **Error handling & loading states** — Skeleton loaders, error boundaries, toast notifications throughout. Done = no unhandled errors, all async operations show loading/error states.

