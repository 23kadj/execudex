-- Persistent cache of domain trust verdicts so ppl_round1/ppl_round2 (and any
-- future sourcing pipeline) judge an unknown domain once, not on every run for
-- every politician. Recency/content-type checks (press release, opinion, staleness)
-- still happen per-page at call time; only the domain-level institution/partisanship
-- verdict is cached here.
create table if not exists domain_judgments (
  domain text primary key,
  verdict text not null check (verdict in ('allow', 'block')),
  score numeric,
  institution text,
  official_affiliation boolean,
  partisanship text,
  reasons text[],
  judged_by text not null default 'mistral-small-latest',
  first_judged_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  use_count integer not null default 1
);

create index if not exists domain_judgments_verdict_idx on domain_judgments (verdict);

comment on table domain_judgments is
  'Cached per-domain trust verdicts from the LLM domain judge, shared across ppl_round1/ppl_round2/etc so a domain is only judged once.';
