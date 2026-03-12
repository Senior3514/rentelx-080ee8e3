

# Full E2E Implementation Plan

## Current State
- i18n (HE/EN, RTL/LTR) ✅
- Theme (light/dark) ✅  
- Design tokens ✅
- Onboarding wizard UI ✅ (client-only, no DB persistence)
- Database: **empty** — no tables, no auth
- No app shell, no pages beyond onboarding

## What We'll Build

### 1. Database Schema (Supabase Migration)
Create all core tables with RLS:
- `profiles` — user profile data (linked to auth.users)
- `search_profiles` — cities, budget, rooms, must-haves per user
- `listings` — aggregated listing data with fingerprint for dedup
- `listing_scores` — score per listing×profile
- `listing_notes` — user notes on listings
- `listing_reminders` — scheduled reminders
- `pipeline_entries` — stage tracking (enum: new, contacted, viewing_scheduled, viewed, negotiating, signed, lost)
- `notification_preferences` — per-user notification config
- Auto-create profile trigger on signup

### 2. Auth Flow
- Login page (`/login`) with email + password
- Signup page (`/signup`) with email + password  
- Password reset page (`/reset-password`)
- `AuthProvider` context wrapping the app
- Protected route wrapper — unauthenticated users → `/login`
- Post-signup redirect → onboarding wizard
- Add auth translations to en.json / he.json

### 3. Onboarding → DB Persistence
- After wizard completion, insert `search_profiles` row via Supabase
- Update user profile `onboarded = true`
- Redirect to `/inbox`

### 4. App Shell & Navigation
- Sidebar layout component with nav links: Inbox, Pipeline, Profiles, Settings
- Mobile-responsive: collapsible sidebar / bottom nav
- Language + theme toggles in sidebar footer
- Routes: `/inbox`, `/pipeline`, `/profiles`, `/settings`, `/listings/:id`

### 5. Listings Inbox Page (`/inbox`)
- Fetch listings + scores for user's active profiles via React Query
- Card list sorted by score (color-coded badge: green ≥80, yellow ≥50, red <50)
- Filter bar: city, profile, score threshold, status
- "Add Listing" button → modal with URL input + manual form
- Quick actions per card: Save, Dismiss, Contact
- Empty state with onboarding prompts (paste link, Telegram bot instructions)

### 6. Add Listing Flow
- Modal with two tabs: "Paste URL" and "Manual Entry"
- Manual form: address, city, price, rooms, sqm, floor, description, contact info
- Inserts into `listings` table, triggers scoring
- Client-side scoring function (weighted match against search profile criteria)

### 7. Listing Detail Page (`/listings/:id`)
- Image placeholder area, key stats grid (price, rooms, sqm, floor)
- Score breakdown visualization
- Full description with RTL support
- Notes section (add/view notes)
- Actions: Move to Pipeline, Dismiss, Add Note
- Reminder scheduler (date picker + message)

### 8. Pipeline Board (`/pipeline`)
- Kanban columns: New → Contacted → Viewing Scheduled → Viewed → Negotiating → Signed / Lost
- Cards with listing title, price, score, days-in-stage
- Drag-and-drop between columns (using HTML drag API, no extra deps)
- Mobile: horizontal scroll or grouped list view

### 9. Search Profiles Page (`/profiles`)
- List of profile cards (name, cities, budget summary, listing count)
- Edit → opens wizard pre-filled
- Delete with confirmation
- "+ New Profile" button

### 10. Settings Page (`/settings`)
- Account section (email, display name)
- Language toggle (HE/EN)
- Theme toggle (Light/Dark/System)
- Notification preferences (score threshold slider)
- Logout button

## Technical Approach
- **Auth**: Supabase Auth with `onAuthStateChange` listener
- **State**: React Query for all DB reads, mutations for writes
- **Routing**: react-router-dom with layout routes for app shell
- **Scoring**: Client-side weighted scoring (price match, room match, amenity match, city match) — no edge function needed for MVP
- **Drag-and-drop**: Native HTML5 drag API to avoid adding dependencies
- **All pages**: Full RTL/LTR support using logical properties (`start`/`end`)

## File Structure (new files)
```
src/
  contexts/AuthContext.tsx
  components/
    layout/AppShell.tsx, Sidebar.tsx, ProtectedRoute.tsx
    listings/ListingCard.tsx, AddListingModal.tsx, ListingFilters.tsx
    pipeline/PipelineBoard.tsx, PipelineColumn.tsx, PipelineCard.tsx
    profiles/ProfileCard.tsx, ProfileEditor.tsx
  pages/
    Login.tsx, Signup.tsx, ResetPassword.tsx
    Inbox.tsx, ListingDetail.tsx, Pipeline.tsx
    Profiles.tsx, Settings.tsx
  lib/scoring.ts
```

## Order of Implementation
1. DB migration (all tables + RLS + trigger)
2. Auth context + login/signup pages + protected routes
3. App shell + sidebar + routing
4. Wire onboarding to DB
5. Listings inbox + add listing modal
6. Listing detail page
7. Pipeline board
8. Profiles CRUD page
9. Settings page

