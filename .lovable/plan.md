

# Massive E2E Upgrade Plan

## What's Working (Preserved)
- i18n (HE/EN, RTL/LTR), theme (light/dark/system), design tokens
- Onboarding wizard with DB persistence
- Auth (email/password + anonymous guest)
- App shell with sidebar navigation
- Inbox, Pipeline, ListingDetail, Profiles, Settings pages
- Scoring engine, RLS policies on all tables
- AI edge function (OpenRouter/Gemini)

## Issues Found

### Security Issues
1. **All Supabase calls use `(supabase as any)`** — bypasses TypeScript type safety entirely. Every query across Inbox, Pipeline, Profiles, Settings, ListingDetail, AddListingModal, Index is untyped.
2. **No input validation** on AddListingModal manual form (price, rooms, sqm, floor accept any number including negatives; no length limits on text fields).
3. **No input validation** on Signup (only client-side password match check, no strength requirements beyond minLength=6).
4. **No input validation** on notes (ListingDetail noteText — no length limit).
5. **No URL validation** on "Paste URL" tab in AddListingModal (accepts any string).
6. **No XSS protection** — listing description rendered with `whitespace-pre-wrap` directly. If malicious content is stored, it could be an issue (though React auto-escapes JSX, the description field is safe, but contact_phone/contact_name have no sanitization before insert).
7. **Missing `user_id` guard in queries** — ListingDetail fetches by `id` only, no `user_id` check (RLS handles it, but a failed RLS returns empty not 403, leading to confusing "Not found").
8. **Console warnings** — `AddListingModal` and `DialogContent` have ref forwarding issues.

### Functional Issues
9. **Pipeline board**: No empty state, no mobile-friendly view (horizontal scroll only).
10. **Inbox**: No sort controls (translation key exists but unused), no score filter.
11. **ListingDetail**: No score breakdown visualization (just shows total), no AI analysis integration.
12. **Profiles page**: No edit capability (only create/delete).
13. **Settings**: Hardcoded English strings ("Account", "Theme", "Notifications", "Email notifications").
14. **ResetPassword**: Hardcoded English strings ("New Password", "Update Password", "Send Reset Link").
15. **Login**: "Continue as Guest" and "or" divider hardcoded in English.
16. **Signup**: "Passwords don't match" and success toast hardcoded in English.

## Plan

### 1. Remove all `(supabase as any)` casts — use typed client
Replace every `(supabase as any).from(...)` with `supabase.from(...)` across all files. The generated types already support all tables. This gives compile-time safety on every query.

**Files**: Inbox.tsx, Pipeline.tsx, Profiles.tsx, Settings.tsx, ListingDetail.tsx, AddListingModal.tsx, Index.tsx

### 2. Input validation with Zod
- **AddListingModal**: Validate URL format (paste tab), validate price > 0, rooms 0.5-20, sqm 1-1000, floor -5 to 100, text fields max 500 chars, contact_phone pattern.
- **Signup**: Password strength (min 8 chars, at least one number).
- **ListingDetail notes**: Max 2000 chars.
- Show inline validation errors.

### 3. Fix ref forwarding warning
The `AddListingModal` component is a named export but not wrapped in `forwardRef`. The Dialog component tries to pass a ref. Fix by ensuring the component doesn't receive unexpected refs or by wrapping appropriately.

### 4. Inbox enhancements
- Add sort dropdown (by score desc, price asc/desc, newest).
- Add score threshold filter slider.
- Add city filter dropdown.

### 5. ListingDetail — AI analysis + score breakdown
- Add score breakdown bars (city, price, rooms, amenities) with percentage labels.
- Add "AI Analysis" button that calls the `ai-assist` edge function with listing data, streams response into a card.
- Add dismiss button (sets listing status to "dismissed").

### 6. Pipeline mobile view
- On mobile (< 768px), show a grouped list view instead of horizontal scroll.
- Add empty state message per column.
- Add total count header.

### 7. Profiles — Edit support
- Add edit button on each profile card.
- Opens the OnboardingWizard pre-filled with existing values in a dialog.
- Uses update mutation instead of insert.

### 8. Full i18n coverage
Add missing translation keys to both en.json and he.json for all hardcoded strings across Settings, ResetPassword, Login, Signup, Pipeline, Profiles, ListingDetail.

### 9. Settings enhancements
- Display name edit field (updates profiles table).
- All strings translated.

### 10. E2E validation pass
After all changes, verify:
- Guest login → onboarding → inbox flow
- Add listing (manual) with validation errors shown
- Listing detail with score breakdown + AI analysis
- Pipeline drag-and-drop
- Profile create/edit/delete
- Settings save
- Language toggle (all pages)
- Dark mode (all pages)
- Mobile responsive (all pages)

## Technical Details

### Files to modify (approximately 12 files):
- `src/pages/Inbox.tsx` — remove `as any`, add sort/filter controls
- `src/pages/Pipeline.tsx` — remove `as any`, mobile view, empty states
- `src/pages/Profiles.tsx` — remove `as any`, add edit support
- `src/pages/Settings.tsx` — remove `as any`, display name, translations
- `src/pages/ListingDetail.tsx` — remove `as any`, score breakdown, AI analysis, dismiss
- `src/pages/Login.tsx` — translate guest button
- `src/pages/Signup.tsx` — validation, translations
- `src/pages/ResetPassword.tsx` — translations
- `src/pages/Index.tsx` — remove `as any`
- `src/components/listings/AddListingModal.tsx` — remove `as any`, Zod validation, fix ref
- `src/i18n/translations/en.json` — add missing keys
- `src/i18n/translations/he.json` — add missing keys

### No new dependencies needed
Zod is already installed. All UI components already available.

### No database changes needed
Schema is complete and correct.

