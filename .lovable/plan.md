

# RentelX -- Next-Level Upgrade Plan

## Current State
The app is functional with auth, onboarding, inbox, pipeline, profiles, settings, and AI analysis. The branding still says "Rental Co-Pilot" everywhere. Hebrew works but needs polish. Security scan shows anonymous access policy warnings (expected since we support guest login) and leaked password protection disabled.

## Issues Found

### Branding
1. App name is "Rental Co-Pilot" in both translation files -- must be "RentelX"
2. localStorage key is `rental-copilot-lang` and `rental-copilot-theme` -- update to `rentelx-lang`/`rentelx-theme`

### Console Errors
3. `forwardRef` warning on `AddListingModal` -- the Dialog component passes a ref to the function component

### Security
4. Function search_path mutable warning -- need to set `search_path` on any DB functions
5. Leaked password protection disabled -- user needs to enable in Supabase dashboard
6. Anonymous access policies -- expected (guest login feature), but all RLS policies properly check `auth.uid() = user_id`

### Missing Features / Polish
7. No dashboard/stats page -- add a simple Dashboard as the main logged-in landing
8. Index.tsx onboarding success toast is hardcoded English: "Profile created! Let's find your home."
9. NotFound page is hardcoded English
10. No profile name input in the onboarding wizard (the field exists in the data model but the wizard doesn't show it)
11. Listing cards don't show creation date/time ago
12. No listing count badge in sidebar nav items

### Hebrew Organization
13. Inbox filter controls layout needs better RTL alignment
14. Pipeline stage labels are fine but the mobile grouped view could use better spacing

## Plan

### 1. Rebrand to RentelX
- Update `en.json` and `he.json`: `app.name` → "RentelX", `app.tagline` updated
- Update `LanguageContext.tsx` localStorage key to `rentelx-lang`
- Update `ThemeContext.tsx` localStorage key to `rentelx-theme`

### 2. Fix forwardRef warning
- Wrap `AddListingModal` content in a way that doesn't receive refs from Dialog, or use `forwardRef`

### 3. Add Dashboard page
- New `src/pages/Dashboard.tsx` with:
  - Welcome message with user's display name
  - Stats cards: total listings, avg score, pipeline stages breakdown
  - Quick actions: Add Listing, View Inbox, Manage Profiles
  - Recent activity feed (last 5 listings added)
- Update `App.tsx` routing: `/dashboard` as the main protected landing
- Update `AppSidebar.tsx`: add Dashboard nav item with `LayoutDashboard` icon
- Update onboarding redirect and login redirect to `/dashboard`

### 4. Complete i18n gaps
- Add translation keys for: Dashboard page, NotFound page, onboarding success toast
- Update `NotFound.tsx` to use `t()` for all strings
- Fix hardcoded "Profile created!" in `Index.tsx`

### 5. Enhance Listing Cards
- Add relative time (e.g., "2d ago") using `date-fns` `formatDistanceToNow`
- Show amenities count badge

### 6. Add profile name step to onboarding
- Add a name input field at the top of step 1 (cities step) or as a small input above the wizard

### 7. Security acknowledgments
- The anonymous access policies are expected behavior for guest login
- Recommend user enables leaked password protection (note in response)
- The function search_path warning relates to the DB trigger -- will add a migration to fix

### Files to modify (~10 files):
- `src/i18n/translations/en.json` -- rebrand + new keys
- `src/i18n/translations/he.json` -- rebrand + new keys
- `src/i18n/LanguageContext.tsx` -- localStorage key
- `src/i18n/ThemeContext.tsx` -- localStorage key
- `src/pages/Dashboard.tsx` -- NEW dashboard page
- `src/pages/Index.tsx` -- fix hardcoded string, redirect to dashboard
- `src/pages/NotFound.tsx` -- i18n
- `src/pages/Login.tsx` -- redirect to dashboard
- `src/App.tsx` -- add dashboard route
- `src/components/layout/AppSidebar.tsx` -- add dashboard nav item
- `src/components/listings/ListingCard.tsx` -- time ago + amenities
- `src/components/listings/AddListingModal.tsx` -- fix ref warning
- `src/components/onboarding/OnboardingWizard.tsx` -- profile name input

### DB Migration
- Fix function search_path on the `handle_new_user` trigger function (if it exists)

### No new dependencies needed
- `date-fns` already installed

