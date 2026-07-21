# Execudex - Scripts Overview

**Last updated:** July 2026 (verified against repository)

## App Summary

**Execudex** is a React Native/Expo mobile app that delivers AI-generated political intelligence on U.S. politicians and legislation. Users search, open profiles, generate content cards on demand, and view grounded Q&A. The client never calls Mistral or Tavily directly — all AI and web acquisition runs in Supabase Edge Functions.

**Authoritative reference:** `EXECUDEX_API_AND_DATA_PIPELINE.md` for full pipeline detail.

## Architecture

- **Frontend:** Expo SDK ~54, React Native 0.81, Expo Router (`app/`)
- **Profile shells:** `app/index1.tsx` (politicians), `app/index2.tsx` (legislation)
- **Backend:** Supabase PostgreSQL + Storage + Edge Functions (Deno/TypeScript)
- **Key tables:** `ppl_index`, `ppl_profiles`, `legi_index`, `legi_profiles`, `card_index`, `card_content`, `web_content`, `questions`
- **External APIs:** Tavily (search/extract), Mistral AI (LLM), Congress.gov / VoteSmart (via fetch + Jina Reader proxy). **No ProPublica API** in current code.

---

## Supabase Edge Functions

### Politician functions

| Function | Triggered by | Purpose |
|----------|--------------|---------|
| `ppl_search` | `home.tsx` search | Tavily + Wikipedia discovery; Mistral match/extract; upsert `ppl_index` |
| `ppl_round1` | **Not app-triggered** | Legacy/batch Tavily ingest with domain judge (similar to round2) |
| `ppl_round2` | Card generation (no cached `web_content`) | Tavily search per category; store to `web` bucket |
| `profile_index` | Profile open | Wikipedia/Congress fetch; **computes tier** (hard/soft/base); creates `ppl_profiles` row |
| `ppl_synopsis` | Profile open | Mistral synopsis → `ppl_profiles` |
| `ppl_card_gen` | Generate buttons | Mistral card metadata → `card_index`; tier category enforcement |
| `ppl_metrics` | `see-more.tsx` button | Mistral poll synthesis → approval/disapproval/votes |
| `ppl_affiliates` | `sub3.tsx` | Related politician suggestions |
| `ppl_scoring` | `rankings.tsx` | User-submitted scores → `ppl_scores` |
| `profile_labeling` | `CardGenerationService` | `mark_weak` / `mark_unweak` on index tables |
| `records_open` | `records.tsx` (per card) | Acquire VoteSmart voting-record source text |
| `records_update` | `synop.tsx` (manual) | Process voting records into profile |

### Legislation functions

| Function | Triggered by | Purpose |
|----------|--------------|---------|
| `bill_search` | `home.tsx` search; enrich on stale bills | Tavily + Mistral; stores `synopsis.*` files in Storage |
| `profile_index` | Profile open (legislation mode) | Congress.gov synopsis via Tavily/Mistral |
| `bill_overview` | Profile open | Mistral overview → `legi_profiles` |
| `bill_text` | Batch (`legislation_profile_processor`) | Full bill text → `billtext.*` storage paths |
| `bill_cards` | Overview generate + legi1/legi2 buttons | Agenda + impact cards from `billtext`/`synopsis` |
| `bill_coverage` | legi3 generate button | Discourse + coverage cards from news sources |
| `bill_update` | Cron / manual | Congress.gov most-viewed bills refresh |
| `legislation_profile_processor` | **Batch only (not app)** | Orchestrates legi pipeline; skips card gen on initial run |

### Shared / utility functions

| Function | Triggered by | Purpose |
|----------|--------------|---------|
| `full_card_gen` | `CardService` on card open | `body_text`, `tldr`, `excerpt`, demographics tagging |
| `impact_gen` | `sub5.tsx`, `legi5.tsx`, `CardService` | Personalized impact text per user |
| `card-questions` | `card-questions.tsx` | Grounded Q&A (55-word max, source-only) |
| `card_opens` | `cardOpensTracker` | Increment `opens_7d` on `card_index` |
| `profile_opens` | `cardOpensTracker` | Profile visit counters |
| `check_profile_access` | `NavigationService` | Weekly profile quota for free tier |
| `save_onboard_data` | Onboarding flow | Store user preferences |
| `verify_receipt` / `apple_webhook` | IAP (Apple) | Subscription verification |
| `update_subscription_status` | IAP (Android) | Subscription sync |
| `delete-account` | Settings | Account deletion |

---

## Client services (orchestration)

| Service | Role |
|---------|------|
| `navigationService.ts` | Access check → profile processing → route to index1/index2 |
| `politicianProfileService.ts` | `profile_index` → `ppl_synopsis` → mark indexed |
| `legislationProfileService.ts` | Optional `bill_search` enrich → `profile_index` → `bill_overview` → mark indexed |
| `cardGenerationService.ts` | `ppl_round2`/`ppl_card_gen` or `bill_cards`/`bill_coverage` on Generate |
| `cardService.ts` | `full_card_gen` + `impact_gen` when opening a card |
| `profileAccessService.ts` | Wraps `check_profile_access` with retries |

---

## Python / test scripts

| Script | Purpose |
|--------|---------|
| `test_ppl_cards.py` | Standalone/testing card generation (see `PYTHON_SCRIPT_README.md`) |
| `test_optimized_congress_filter.js` | Congress filter logic tests |

---

## Key patterns

1. **Evidence-centric:** Cards link to `web_content` + Storage source text, not free-form LLM output.
2. **On-demand generation:** Cards are created when the user taps Generate (no swipe-to-fill).
3. **Tier categories:** `ppl_card_gen` enforces allowed categories per hard/soft/base tier.
4. **Two-step card display:** `ppl_card_gen`/`bill_cards` create `card_index` metadata; `full_card_gen` runs when the user opens the card.
5. **Indexed = skip:** Once `indexed = true`, profile open skips the processing pipeline.
6. **Domain governance:** `ppl_round1`/`ppl_round2` use allowlists + Mistral domain judge for unknown URLs.

---

## Typical flows

**Politician**
1. Search → `ppl_search`
2. Open profile → `profile_index` + `ppl_synopsis` (if not indexed) via `index1.tsx`
3. Generate cards → `ppl_round2` (if needed) → `ppl_card_gen`
4. Open card → `full_card_gen` → `impact_gen`

**Legislation**
1. Search → `bill_search`
2. Open profile → `profile_index` + `bill_overview` (if not indexed) via `index2.tsx`
3. First cards → Overview **Generate** or legi tab buttons → `bill_cards` / `bill_coverage`
4. Open card → `full_card_gen` → `impact_gen`
