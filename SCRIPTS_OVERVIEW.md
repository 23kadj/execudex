# Execudex - Scripts Overview

## App Summary
**Execudex** is a React Native/Expo mobile app that provides comprehensive political intelligence on U.S. politicians and legislation. Users can search, browse profiles, view AI-generated content cards, and track legislative activity. The app uses Supabase for backend/auth and integrates with Tavily (search), Mistral AI (content generation), and ProPublica Congress API.

## Architecture
- **Frontend**: React Native/Expo with TypeScript, file-based routing (`app/` directory)
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **Key Tables**: `ppl_index` (politician profiles), `legi_index` (legislation), `card_index` (content cards), `ppl_profiles` (profile data), `legi_profiles` (bill data)
- **External APIs**: Tavily (web search), Mistral AI (LLM), ProPublica Congress API

---

## Supabase Edge Functions (TypeScript/Deno)

### Politician Profile Scripts

**`ppl_search/index.ts`**
- **Purpose**: Main search/discovery endpoint for politicians
- **Function**: Takes search query, searches Wikipedia + Tavily, scrapes/analyzes web pages, returns ranked list with metrics (influence, sentiment, recency)
- **Key Features**: Concurrency control, Wikipedia integration, content caching in Supabase Storage, common name normalization

**`ppl_card_gen/index.ts`**
- **Purpose**: Generates content cards for politician profiles (on-demand)
- **Function**: Given politician ID + bucket specs, searches web content, uses Mistral AI to create structured cards with title/subtext/category/score
- **Key Features**: Tier-based quotas (hard/soft/base), evidence requirements, category validation, deduplication, freshness management (7-day rule), media source tagging

**`ppl_synopsis/index.ts`**
- **Purpose**: Creates initial AI-generated synopsis for new politician profiles
- **Function**: Processes cached Wikipedia + web content, generates structured JSON synopsis with background, career, positions, metrics

**`ppl_round1/index.ts` & `ppl_round2/index.ts`**
- **Purpose**: Two-stage profile processing pipeline
- **Function**: Round1 creates initial profile structure; Round2 enriches with additional data and metrics

**`ppl_metrics/index.ts`**
- **Purpose**: Calculates influence/sentiment/recency scores for politicians
- **Function**: Analyzes profile data and generates quantitative metrics

**`profile_index/index.ts`**
- **Purpose**: Manages indexing status of politician profiles
- **Function**: Updates `indexed` flag when profile data is complete

**`profile_labeling/index.ts`**
- **Purpose**: Assigns tier labels (hard/soft/base) to politicians based on influence
- **Function**: Categorizes politicians for quota management

**`check_profile_access/index.ts`**
- **Purpose**: User subscription/quota management
- **Function**: Validates if user can access politician profiles based on tier limits

### Legislation Scripts

**`bill_search/index.ts`**
- **Purpose**: Search endpoint for federal legislation
- **Function**: Queries ProPublica Congress API, returns bill metadata with status/sponsors/committees

**`bill_overview/index.ts`**
- **Purpose**: Generates comprehensive bill overview with AI
- **Function**: Fetches bill data from Congress.gov, uses Mistral AI to create structured overview with summary, key provisions, status, sponsors

**`bill_text/index.ts`**
- **Purpose**: Retrieves full text of legislation
- **Function**: Scrapes bill text from Congress.gov

**`bill_cards/index.ts`**
- **Purpose**: Generates content cards for legislation
- **Function**: Similar to `ppl_card_gen` but for bills (key provisions, impact, stakeholder positions)

**`bill_coverage/index.ts`**
- **Purpose**: Finds media coverage and analysis of legislation
- **Function**: Searches and aggregates news articles about specific bills

**`legislation_profile_processor/index.ts`**
- **Purpose**: Batch processing pipeline for legislation profiles
- **Function**: Orchestrates overview generation, card creation, and indexing for bills

### Utility Scripts

**`full_card_gen/index.ts`**
- **Purpose**: Unified card generation endpoint (handles both politicians and legislation)
- **Function**: Routes to appropriate card generator based on entity type

**`save_onboard_data/index.ts`**
- **Purpose**: Saves user onboarding preferences
- **Function**: Stores initial user settings/interests during signup

---

## Python Scripts

**`test_ppl_cards.py` / `card_content.py`**
- **Purpose**: Standalone Python implementation of politician card generation
- **Function**: Alternative/testing version of `ppl_card_gen` - fetches politician data, searches web, generates cards via Mistral AI
- **Key Features**: Tier-based quotas, 7-day freshness rule, category organization, duplicate prevention
- **Usage**: `python test_ppl_cards.py <politician_id>`
- **Note**: Detailed documentation in `PYTHON_SCRIPT_README.md`

**`test_optimized_congress_filter.js`**
- **Purpose**: Testing script for Congress data filtering
- **Function**: Validates bill search/filter logic

---

## Key Script Patterns

1. **AI Content Generation**: Most scripts follow pattern: search → scrape → clean → LLM analysis → structured output
2. **Tier System**: Politicians categorized as hard/soft/base with different card quotas (180/72/30)
3. **Freshness Management**: Old cards (>7 days) automatically pruned during generation
4. **Concurrency Control**: Parallel processing with configurable limits for performance
5. **Evidence Requirements**: Cards must cite source material (except metrics categories)
6. **Category Validation**: Strict category/screen assignment based on tier
7. **Storage Optimization**: Large content cached in Supabase Storage, metadata in PostgreSQL

---

## Script Interaction Flow
1. User searches politician → `ppl_search` returns ranked results
2. User views profile → `ppl_synopsis` generates overview (if needed)
3. User swipes cards → `ppl_card_gen` fills card deficits on-demand
4. User searches legislation → `bill_search` returns bills
5. User views bill → `bill_overview` generates summary, `bill_cards` creates analysis cards

