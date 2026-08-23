-- THE DETECTIVE, section 12. Competing explanations, and what would end each.
--
-- The specification's rule is that the system "must never be forced into one
-- theory", and the schema is shaped to make that hard to violate rather than
-- to ask nicely.
--
-- `falsifier` is not null. A hypothesis with no statement of what would make
-- the investigator abandon it is a belief, and there is no column here to
-- store one in. That is Popper restated for a case file: a theory no possible
-- finding could count against is not being tested by any of the evidence
-- gathered for it, and it is the one that survives an investigation regardless
-- of what the investigation found.
--
-- What is deliberately absent is any notion of rank. No score, no confidence,
-- no "leading" flag. Section 4 forbids collapsing information into truth, and a
-- leaderboard of theories is that collapse wearing a number.

create table if not exists public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  statement text not null check (length(btrim(statement)) between 1 and 500),
  -- Required, and the whole point of the table.
  falsifier text not null check (length(btrim(falsifier)) between 1 and 500),
  -- Stated assumptions. An empty array is a legitimate state and a finding:
  -- the skeptic names it rather than the constraint refusing it, because an
  -- investigator part-way through writing one should not be blocked.
  assumptions text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Needed by the composite foreign key below, which is what keeps a
  -- hypothesis and its evidence inside the same investigation.
  unique (case_id, id)
);

comment on table public.hypotheses is
  'A competing explanation, with what would make the investigator abandon it. Never ranked or scored.';

create index if not exists hypotheses_case_idx on public.hypotheses (case_id, created_at);

-- What bears on a hypothesis, and how.
--
-- A separate link rather than a column on `evidence`, because the same record
-- bears on different explanations differently: the weather report that
-- supports "nobody could have seen the van" is the same row that contradicts
-- "the witness identified it clearly". One classification per pair, not per
-- record.
create table if not exists public.hypothesis_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  hypothesis_id uuid not null,
  source_id uuid not null,
  classification public.evidence_classification not null,
  -- What in the source says this. A quotation somebody can go and check, the
  -- same requirement section 6 puts on claim evidence.
  summary text not null check (length(btrim(summary)) between 1 and 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- The isolation, carried the same way `evidence` carries it: both ends must
  -- belong to the case this row belongs to, so a link across investigations
  -- cannot be inserted at all.
  constraint hypothesis_evidence_same_case
    foreign key (case_id, hypothesis_id) references public.hypotheses (case_id, id) on delete cascade,
  constraint hypothesis_evidence_source_same_case
    foreign key (case_id, source_id) references public.sources (case_id, id) on delete cascade,

  -- One source may bear on one hypothesis several times — three statements
  -- from one witness are three records — but not twice identically, which
  -- is a double-entry rather than corroboration.
  unique (hypothesis_id, source_id, summary)
);

comment on table public.hypothesis_evidence is
  'What bears on a hypothesis and how. The same record may support one explanation and contradict another.';

create index if not exists hypothesis_evidence_hypothesis_idx
  on public.hypothesis_evidence (hypothesis_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- `enable`, not `force`: the case predicates are definer functions reading as
-- the owner.
alter table public.hypotheses enable row level security;
alter table public.hypothesis_evidence enable row level security;

drop policy if exists hypotheses_select on public.hypotheses;
drop policy if exists hypotheses_insert on public.hypotheses;
drop policy if exists hypotheses_update on public.hypotheses;
drop policy if exists hypotheses_delete on public.hypotheses;

create policy hypotheses_select on public.hypotheses
  for select using (public.can_read_case(case_id));
create policy hypotheses_insert on public.hypotheses
  for insert with check (public.can_write_case(case_id));
create policy hypotheses_update on public.hypotheses
  for update using (public.can_write_case(case_id)) with check (public.can_write_case(case_id));
create policy hypotheses_delete on public.hypotheses
  for delete using (public.can_write_case(case_id));

drop policy if exists hypothesis_evidence_select on public.hypothesis_evidence;
drop policy if exists hypothesis_evidence_insert on public.hypothesis_evidence;
drop policy if exists hypothesis_evidence_delete on public.hypothesis_evidence;

create policy hypothesis_evidence_select on public.hypothesis_evidence
  for select using (public.can_read_case(case_id));
create policy hypothesis_evidence_insert on public.hypothesis_evidence
  for insert with check (public.can_write_case(case_id));
create policy hypothesis_evidence_delete on public.hypothesis_evidence
  for delete using (public.can_write_case(case_id));

-- No update policy on the link, deliberately. Changing a record from
-- "contradicts" to "supports" in place rewrites the history of what the
-- investigator thought the evidence showed, and that history is the thing the
-- skeptic reads to notice a preferred theory. Unlink and relink instead.

grant select, insert, update, delete on public.hypotheses to authenticated;
grant select, insert, delete on public.hypothesis_evidence to authenticated;
