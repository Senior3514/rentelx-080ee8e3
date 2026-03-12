# Contributing to RentelX

Thank you for contributing to the RentelX Rental Co-Pilot. This guide explains how to run the development environment, submit changes, and follow project conventions.

---

## Prerequisites

| Tool | Min version | Install |
|---|---|---|
| Node.js | 18 | [nvm](https://github.com/nvm-sh/nvm) |
| npm | 9 | bundled with Node |
| Git | any | [git-scm.com](https://git-scm.com) |
| Supabase account | — | [supabase.com](https://supabase.com) |

---

## 1. Clone and install

```sh
git clone https://github.com/Senior3514/rentelx-080ee8e3.git
cd rentelx-080ee8e3
npm install
```

---

## 2. Environment variables

```sh
cp .env.example .env
```

Edit `.env` and fill in your Supabase project values:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Find these values in your Supabase project under **Settings → API**.

---

## 3. Run the dev server

```sh
npm run dev
```

The app starts on [http://localhost:8080](http://localhost:8080).

---

## 4. Project structure

```
src/
  components/   React components (ui/, layout/, listings/, dashboard/, onboarding/)
  contexts/     AuthContext
  data/         Static data files (Israeli cities list)
  hooks/        Custom React hooks
  i18n/         LanguageContext, ThemeContext, translations (en.json, he.json)
  integrations/ Supabase client + auto-generated DB types
  lib/          Pure utility functions (scoring.ts, utils.ts)
  pages/        Route-level components
  test/         Vitest unit tests
supabase/
  functions/    Supabase Edge Functions (Deno/TypeScript)
.github/
  workflows/    CI: lint + test
```

---

## 5. Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint across all source files |
| `npm run test` | Run Vitest unit tests once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run preview` | Preview the production build locally |

---

## 6. Testing

Unit tests live in `src/test/`. We use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/).

- **Run all tests**: `npm run test`
- **Write new tests** in `src/test/<feature>.test.ts`
- Tests must pass before a PR can be merged (enforced by CI)

---

## 7. Linting and formatting

```sh
npm run lint          # check for lint errors
```

ESLint is configured in `eslint.config.js`. The project follows standard React + TypeScript rules. Fix all lint errors before opening a PR.

---

## 8. Branch and commit conventions

- **Branch naming**: `<your-handle>/<short-description>` (e.g. `alice/add-telegram-ingestion`)
- **Commit messages**: imperative mood, present tense (e.g. `add scoring unit tests`, `fix pipeline stage update`)
- Keep commits focused — one logical change per commit

---

## 9. Opening a Pull Request

1. Push your branch to origin
2. Open a PR against `main`
3. Fill in the PR template (summary + test plan)
4. CI must pass (lint + tests) before review
5. Request a review from a maintainer

---

## 10. Supabase schema changes

If your feature requires a schema change:

1. Make the change in the Supabase Studio (or via SQL migration)
2. Regenerate types: `npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`
3. Commit the updated types file alongside your feature code

---

## 11. Adding translations

Edit both `src/i18n/translations/en.json` and `src/i18n/translations/he.json`. Use the `t("key")` helper from `useLanguage()`. Keep keys nested and descriptive.

---

## 12. Future agent extension points

See `NOTES.md` for a list of `// TODO(agent):` markers where future AI/agent integrations are expected. If you're building an agent feature, start from those stubs.
