-- THE DETECTIVE, section 25. Reference numbers, for broadcast and for talking.
--
-- The broadcast overlays the specification lists are "SOURCE 014" and
-- "EVIDENCE E-031". Neither is expressible today: sources and evidence carry
-- uuids, which nobody reads aloud and nobody remembers.
--
-- The number is **stored and never reused**, which is the whole point of this
-- migration and not an implementation detail. Derived from creation order it
-- would be one line of SQL and wrong: deleting source 7 would renumber
-- everything after it, so a presenter who said "look at source fourteen" on
-- Tuesday is pointing at a different record on Wednesday, and a dossier
-- quoting SOURCE 014 stops meaning anything. An investigator saying "source
-- fourteen" in a room has the same problem.

alter table public.sources add column if not exists reference integer;
alter table public.evidence add column if not exists reference integer;

comment on column public.sources.reference is
  'Per-case reference number, assigned once and never reused. What "SOURCE 014" means.';

-- Unique per case, and nullable only for the instant before the trigger fills
-- it — rows that predate this migration are backfilled below.
create unique index if not exists sources_reference_unique
  on public.sources (case_id, reference) where reference is not null;
create unique index if not exists evidence_reference_unique
  on public.evidence (case_id, reference) where reference is not null;

-- ---------------------------------------------------------------------------
-- Assigning one
-- ---------------------------------------------------------------------------

-- max(reference) + 1 within the case, which is deliberately not a sequence.
--
-- A sequence per case cannot be created without DDL at insert time, and a
-- single global sequence would number the first source of a new case 4,097.
-- The cost is a race: two rows inserted into one case at the same instant can
-- compute the same number, and the unique index above turns that into a
-- failed insert rather than a duplicate. For a case file that one person edits
-- that is the right trade — a rare retry against a silent collision that
-- would put two records under one number on air.
create or replace function public.assign_case_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference is not null then
    return new;
  end if;

  if tg_table_name = 'sources' then
    select coalesce(max(s.reference), 0) + 1 into new.reference
    from public.sources s where s.case_id = new.case_id;
  else
    select coalesce(max(e.reference), 0) + 1 into new.reference
    from public.evidence e where e.case_id = new.case_id;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_case_reference() from public;

drop trigger if exists sources_reference_trigger on public.sources;
create trigger sources_reference_trigger
  before insert on public.sources
  for each row execute function public.assign_case_reference();

drop trigger if exists evidence_reference_trigger on public.evidence;
create trigger evidence_reference_trigger
  before insert on public.evidence
  for each row execute function public.assign_case_reference();

-- Rows written before this migration. Numbered by creation order, which is the
-- only order there is for them, and done once: the `where reference is null`
-- makes the third replay a no-op rather than a renumbering.
do $$
begin
  update public.sources s
  set reference = numbered.position
  from (
    select id, row_number() over (partition by case_id order by created_at, id) as position
    from public.sources where reference is null
  ) as numbered
  where s.id = numbered.id and s.reference is null;

  update public.evidence e
  set reference = numbered.position
  from (
    select id, row_number() over (partition by case_id order by created_at, id) as position
    from public.evidence where reference is null
  ) as numbered
  where e.id = numbered.id and e.reference is null;
end $$;
