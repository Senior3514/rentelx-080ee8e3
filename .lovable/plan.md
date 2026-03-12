

# RentelX Full Upgrade Plan

## 1. Fix Build Errors (Critical)

**AddListingModal.tsx line 121** — `.insert(listing)` fails because `listing` is typed as `Record<string, unknown>`. Fix: cast to the proper Supabase insert type using `as any` (data is already validated via zod before this point).

**Relocation.tsx line 662** — `stat.total === 1 && stat.total === totalBoxes && totalBoxes === 0` is logically impossible. Fix: replace with `stat.total === 0 ? 0 : stat.total`.

## 2. Create Supabase Storage Bucket

Run a SQL migration to create a `listing-images` public bucket with RLS policies:
- Authenticated users can upload to their own `user_id/` folder
- Public read access for all images
- Users can delete their own images

The `AddListingModal` already has upload logic — it just needs the bucket to exist.

## 3. RTL/LTR Fixes

- **AppSidebar.tsx line 48**: Hardcoded `x: -10` animation — change to `direction === "rtl" ? 10 : -10`
- **Landing.tsx**: `FlowDot` component uses hardcoded `left: "0%"` → `"100%"` — needs to reverse in RTL
- **index.css line 203**: `.link-underline::after` uses `origin-left` — already has RTL override on line 205, good
- **ChevronRight icons**: Add `flip-rtl` class where used in Landing page

## 4. Collapsible AI Chat Panel

Update `AIChatBubble.tsx` to add a minimized state — clicking the header bar toggles between full chat and a compact header-only strip showing "RentelX AI" with the green dot.

## 5. Animation Enhancements

- Add `animate-sparkle` and `animate-bounce-subtle` keyframes — already exist in CSS (lines 322-333), confirmed working
- Add `glow-primary` class usage — already defined (line 182)
- Landing page already has parallax orbs, staggered reveals, and animated counters — no changes needed

## 6. Security Audit

- `AddListingModal` already uses zod validation for URLs and inputs
- No `dangerouslySetInnerHTML` usage found
- `listing_scores` table is missing UPDATE and DELETE RLS policies — add them via migration so re-scoring works
- All mutations require authenticated user via `useAuth()` — confirmed

## 7. UI Polish

- Add loading skeletons to Inbox page (shimmer class already exists in CSS)
- Ensure all pages use `PageHeader` component consistently

## Files to modify:
- `src/components/listings/AddListingModal.tsx` — fix TS error on line 121
- `src/pages/Relocation.tsx` — fix impossible comparison on line 662
- `src/components/layout/AppSidebar.tsx` — RTL animation fix
- `src/components/AIChatBubble.tsx` — add collapsible/minimized state
- `src/pages/Landing.tsx` — RTL fix for FlowDot, add flip-rtl to chevrons
- SQL migration: create `listing-images` bucket + add `listing_scores` UPDATE/DELETE policies

