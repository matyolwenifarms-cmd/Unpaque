-- THE RESEARCHER. Screening decisions, from which the PRISMA diagram is counted.
--
-- One row per record considered, carrying what happened to it. There is
-- deliberately no table of totals: the diagram is derived from these rows in
-- `research/prisma/flow.ts`, so the state where the picture disagrees with the
-- reviewer's own decisions has nowhere to live.
--
-- Rejected: a `study_prisma_counts` table written alongside, so a screen could
-- read six numbers instead of counting several hundred rows. It would be
-- faster and it would be a second copy of the truth, and a second copy of the
-- truth in a systematic review is the exact defect a PRISMA diagram exists to
-- expose.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'screening_state') then
    create type public.screening_state as enum (
      'identified',
      'duplicate',
      'excluded_on_title',
      'assessed',
      'excluded_on_full_text',
      'included'
    );
  end if;
end $$;

create table if not exists public.study_screening (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,

  label text not null check (length(btrim(label)) between 1 and 500),
  state public.screening_state not null default 'identified',

  -- Required by PRISMA 2020 for a full-text exclusion and not for a title
  -- screen, which is why the constraint names one state and not the other. A
  -- diagram reading "excluded (n = 14)" with nothing beside it is the box a
  -- reviewer asks about first.
  reason text check (reason is null or length(btrim(reason)) between 3 and 500),
  constraint study_screening_full_text_needs_a_reason
    check (state <> 'excluded_on_full_text' or reason is not null),

  -- Where it came from: a provider, a hand search, a reference list. PRISMA
  -- 2020 wants records identified from databases and from other methods
  -- reported separately, and without this they cannot be.
  found_via text check (found_via is null or length(btrim(found_via)) between 1 and 120),

  -- The identifier, where there is one. Used to notice the same work arriving
  -- from two databases, which is what the duplicate box counts.
  doi text check (doi is null or doi ~ '^10\.[0-9]{4,9}/[^[:space:]]+$'),

  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),

  -- A decision has a decider and a time, or it is not a decision. An
  -- `identified` row has neither, because nobody has decided anything about it
  -- yet.
  constraint study_screening_decided_together
    check ((state = 'identified') = (decided_at is null))
);

comment on table public.study_screening is
  'One record considered for a review. The PRISMA diagram is counted from these rows and stored nowhere.';

create index if not exists study_screening_study_idx
  on public.study_screening (study_id, state, created_at);
create index if not exists study_screening_doi_idx
  on public.study_screening (study_id, doi) where doi is not null;

alter table public.study_screening enable row level security;

drop policy if exists study_screening_select on public.study_screening;
drop policy if exists study_screening_insert on public.study_screening;
drop policy if exists study_screening_update on public.study_screening;
drop policy if exists study_screening_delete on public.study_screening;

create policy study_screening_select on public.study_screening
  for select using (public.can_read_study(study_id));
create policy study_screening_insert on public.study_screening
  for insert with check (public.can_write_study(study_id));
-- Updatable, unlike a page of extracted text. Screening is a sequence of
-- decisions and a reviewer changes their mind; the constraints above hold on
-- the way in either way, so a record cannot be moved to an excluded state
-- without a reason by editing it rather than creating it.
create policy study_screening_update on public.study_screening
  for update using (public.can_write_study(study_id)) with check (public.can_write_study(study_id));
create policy study_screening_delete on public.study_screening
  for delete using (public.can_write_study(study_id));

grant select, insert, update, delete on public.study_screening to authenticated;
