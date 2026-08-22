-- Grouping events that are meant to describe the same moment.
--
-- The timeline engine deliberately does not guess which events ought to
-- coincide: inferring it from labels would manufacture conflicts between
-- records that never claimed to be simultaneous, which is the kind of finding
-- that looks impressive and is worthless. So the investigator says so, and
-- this column is where they say it.
--
-- Free text rather than a foreign key to a `moments` table. A moment is not an
-- entity in the investigation — it is an assertion the investigator is making
-- about which records are about the same thing, and it changes as they learn.
-- A table would give it an identity and a lifecycle it does not have, and the
-- first migration to add would be one for merging two of them.

alter table public.events add column if not exists moment text
  check (moment is null or length(btrim(moment)) between 1 and 200);

comment on column public.events.moment is
  'Investigator''s label for the moment this record is about. Events sharing one are compared for temporal discrepancies; the engine never infers the grouping itself.';

create index if not exists events_moment_idx on public.events (case_id, moment)
  where moment is not null;
