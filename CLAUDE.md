# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Execudex is a React Native / Expo mobile app that delivers AI-generated political intelligence on U.S. politicians and legislation. The client never talks to LLM or search APIs directly — all AI/web-acquisition work happens server-side in Supabase Edge Functions.

## Commands

```bash
npm install            # install deps
npm start              # expo start (dev server)
npm run android         # expo run:android
npm run ios             # expo run:ios
npm run web              # expo start --web
npm run lint             # expo lint (ESLint via eslint-config-expo flat config)
npm run eas:build-android    # eas build --platform android --profile production
npm run eas:submit-android   # eas submit --platform android --profile production
npm run eas:build-ios        # eas build --platform ios --profile production
npm run eas:submit-ios       # eas submit --platform ios --profile production
```

There is no automated test suite (no jest/vitest configured) — verification is manual, via `expo start` and the simulator/device, plus `npm run lint` and `tsc` (strict mode) for type safety.

### App version

The marketing version (`CFBundleShortVersionString` / `versionName`) lives in `app.json` `expo.version`; bump it there for every App Store / Play release and keep `package.json` and `android/app/build.gradle` `versionName` in sync. The build number (`CFBundleVersion` / `versionCode`) is **not** in the repo — `eas.json` sets `appVersionSource: "remote"` with `autoIncrement: true` on the production profile, so EAS increments it server-side per build. Don't add `ios.buildNumber` to `app.json`; it conflicts with the remote source. Note `runtimeVersion.policy` is `"appVersion"`, so bumping the version also changes the runtime version.

Apple rejects a resubmission at the same version (ITMS-90186 / ITMS-90062) — the fix is a version bump in `app.json`, not a build-number change. A new version also needs a matching version record created manually in App Store Connect before it can be submitted for review.

Supabase edge functions are deployed with the Supabase CLI (`supabase functions deploy <name>`) from `supabase/functions/`; each function is an independent Deno/TypeScript module with its own `index.ts`. There's no single "deploy all" script in `package.json` — deploy the specific function(s) you changed.

## Architecture

Two authoritative docs already describe this codebase in depth and should be read before making non-trivial backend/data changes — don't re-derive from scratch what's already written down:

- **`EXECUDEX_API_AND_DATA_PIPELINE.md`** — the primary technical reference: full data model, every edge function and what it calls (Mistral vs Tavily vs Congress.gov/VoteSmart), the end-to-end politician and legislation pipelines, and the app-screen-to-table map. Read this first for anything touching data flow or edge functions.
- **`SCRIPTS_OVERVIEW.md`** — shorter per-function inventory, useful as a quick index.
- **`PPL_ALLOWED_DOMAINS.md`** — the domain allowlist enforced during content acquisition.

### High-level shape

```
Mobile app (Expo Router, app/)
  → supabase.functions.invoke() / supabase.from().select()
    → Supabase Edge Functions (Deno, supabase/functions/*/index.ts)
      → Tavily (search/extract), Mistral AI (chat/completions), Congress.gov, VoteSmart (via Jina proxy)
        → Supabase Storage (`web` bucket, raw extracted text) + PostgreSQL tables
  ← app reads tables back and renders cards/synopses/metrics/Q&A
```

Core product pattern: content is **evidence-centric**. Generated card text is tied to stored source text in `web_content`/Storage, not free-form LLM output — see "Evidence tables" and "Domain Governance" in the pipeline doc.

### Client-side structure

- `app/` — Expo Router file-based routes. Route groups: `(tabs)` (home/search/profile tabs), `profile/` (politician detail screens: `synop`, `sub1`–`sub4` category grids, `sub5` card detail, `see-more` metrics), `legislation/` (`legi1`–`legi5`, `overview`).
- `services/` — orchestration layer between screens and Supabase: `navigationService.ts` (pre-navigation access checks + profile indexing kickoff), `politicianProfileService.ts` / `legislationProfileService.ts` (first-open indexing pipelines), `cardGenerationService.ts` (on-demand card generation), `profileAccessService.ts` (weekly quota gate).
- `utils/supabase.ts` — the Supabase client is a **lazy-loaded singleton**: AsyncStorage is `require()`d only inside `getSupabaseClient()`, not at module scope, specifically to avoid native-module init issues at app boot. Follow this pattern for any new module that touches AsyncStorage or other native modules at import time — top-level native imports have caused splash-screen hangs and crashes in this app before.
- `utils/cardData.ts` — screen-name ↔ DB `screen` column mapping and card fetch/search helpers; the canonical place to look when a new card category or screen is added.
- `lib/diag/`, `utils/persistentLogger.ts`, `utils/globalErrorHandler.ts`, `utils/nativeCallDebugger.ts`, `utils/debugFlags.ts` — debugging/observability infrastructure built up around native-crash investigations (dual AsyncStorage+file logging, wrapped native calls, toggleable feature flags at `/debug-flags`). Sentry (`@sentry/react-native`) is also wired in `app/_layout.tsx` as the primary crash reporter.

### Data model essentials

- Registry tables: `ppl_index` (politicians, has `tier`: hard/soft/base), `legi_index` (bills).
- Profile tables: `ppl_profiles`, `legi_profiles` — AI-generated synopsis/overview text.
- Card tables: `card_index` (metadata) + `card_content` (body) — the modular content unit shown throughout the app, scoped by `owner_id` + `screen` + `is_ppl`.
- `web_content` + Storage `web` bucket — the evidence layer cards are generated from.
- Politician tier (`hard`/`soft`/`base`) drives which card categories are allowed and enforced at generation time in `ppl_card_gen`.

### Root-level docs

The repo root has many dated `*.md` investigation/implementation notes (crash debugging, IAP migration, session persistence, etc.) written during past debugging sessions — treat these as historical context, not current state; check the file's date and cross-reference against the actual code before trusting a claim in one of them. `EXECUDEX_API_AND_DATA_PIPELINE.md` (dated July 2026) is the most current and reliable of these.
