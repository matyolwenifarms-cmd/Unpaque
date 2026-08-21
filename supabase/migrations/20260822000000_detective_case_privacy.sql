-- THE DETECTIVE, phase 0. Case privacy and server-side authorisation, before
-- any investigative data exists to protect.
--
-- The specification's §36 build order puts this ahead of the case/dossier/
-- evidence slice deliberately, and §18 says why: every case is private by
-- default, a private case must remain inaccessible even if its id is guessed,
-- and nobody gains access merely by holding a link. Retrofitting that onto
-- tables that already have rows is how a leak happens.

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'case_role') then
    -- §18's collaboration table. COMMENTER, SOURCE_CONTRIBUTOR and ANALYST are
    -- listed there as future configurable permissions and are included now:
    -- adding an enum value later is cheap, but a role column that has already
    -- been denormalised into policies is not.
    create type public.case_role as enum (
      'owner', 'investigator', 'editor', 'researcher', 'viewer',
      'commenter', 'source_contributor', 'analyst'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'epistemic_status') then
    -- §4. The system must never casually collapse information into truth, so
    -- every important item carries one of these. `unknown` is a legitimate
    -- state and is the default rather than an error.
    create type public.epistemic_status as enum (
      'fact', 'claim', 'inference', 'unresolved', 'corroborated',
      'partially_corroborated', 'contested', 'contradicted', 'unverified',
      'disputed', 'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'case_visibility') then
    -- Two values, not three. §18 makes publishing an explicit confirmed action,
    -- and a middle state like 'unlisted' is exactly the shape that lets a case
    -- become readable by link — which the specification forbids by name.
    create type public.case_visibility as enum ('private', 'published');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.cases (
  -- Unqualified, and therefore resolved from pg_catalog where Postgres 13+
  -- provides it natively. The extensions schema is a Supabase convention and
  -- naming it here would make this migration unappliable to the plain
  -- Postgres 16 the verification script and CI use.
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  question text,
  visibility public.case_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cases is
  'An investigation. Private by default; publishing is an explicit action, never a side effect of sharing a link.';

create table if not exists public.case_collaborators (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.case_role not null,
  -- §18: invitation, then the recipient accepts, then access is granted.
  -- Access follows acceptance, so an unaccepted invitation grants nothing and
  -- a link cannot stand in for one.
  accepted_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

comment on table public.case_collaborators is
  'Who may see a case and in what capacity. A row without accepted_at is an invitation and grants nothing.';

create index if not exists case_collaborators_user_idx
  on public.case_collaborators (user_id) where accepted_at is not null;

-- ---------------------------------------------------------------------------
-- The access predicate
-- ---------------------------------------------------------------------------

-- Policies are dropped before they are recreated, because `create policy` has
-- no `or replace`.
--
-- The functions below are deliberately NOT dropped first, which departs from
-- the usual house habit and is the more important half of this comment.
--
-- Two replay passes taught it. Dropping them fails on the second run of this
-- migration, because its own policies already depend on them. Hoisting the
-- policy drops above the function drops fixes that — and then fails again the
-- moment a *later* migration adds a policy calling the same function, because
-- this migration cannot drop what it does not know about. An earlier migration
-- can never safely drop a function that policies attach to, since policies
-- will keep attaching to it forever.
--
-- `create or replace` is sufficient here and stays correct: these return a
-- fixed type, and if some future migration needs to change one, that migration
-- owns the drop, the cascade and the recreation of everything that depended on
-- it.
drop policy if exists cases_select on public.cases;
drop policy if exists cases_insert on public.cases;
drop policy if exists cases_update on public.cases;
drop policy if exists cases_delete on public.cases;
drop policy if exists collaborators_select on public.case_collaborators;

-- Policies on `cases` need to read `case_collaborators`, and policies on
-- `case_collaborators` need to read `cases`. Written directly, those two
-- policies call each other and Postgres raises "infinite recursion detected in
-- policy for relation" the first time anybody selects — at runtime, on a query
-- that looks innocent.
--
-- A security definer function breaks the cycle: it runs as the owner, so the
-- read inside it is not itself subject to the policy that called it.
create or replace function public.case_role_of(p_case uuid, p_user uuid)
returns public.case_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user is null then null
    when exists (select 1 from public.cases c where c.id = p_case and c.owner_id = p_user)
      then 'owner'::public.case_role
    else (
      select cc.role
      from public.case_collaborators cc
      where cc.case_id = p_case
        and cc.user_id = p_user
        and cc.accepted_at is not null
    )
  end;
$$;

revoke all on function public.case_role_of(uuid, uuid) from public;
grant execute on function public.case_role_of(uuid, uuid) to authenticated, service_role;

create or replace function public.can_read_case(p_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Published cases are readable by anyone; everything else requires a role.
  -- Note what is absent: there is no branch that grants access for holding an
  -- id. §18 forbids it, and the only way to keep that true is to never write
  -- the branch.
  select coalesce(
    (select c.visibility = 'published' from public.cases c where c.id = p_case),
    false
  ) or public.case_role_of(p_case, auth.uid()) is not null;
$$;

revoke all on function public.can_read_case(uuid) from public;
grant execute on function public.can_read_case(uuid) to anon, authenticated, service_role;

create or replace function public.can_write_case(p_case uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.case_role_of(p_case, auth.uid())
    in ('owner', 'investigator', 'editor');
$$;

revoke all on function public.can_write_case(uuid) from public;
grant execute on function public.can_write_case(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- `enable`, not `force`. The definer functions above read these tables as the
-- owner, and forcing RLS would subject the owner to its own policies and
-- filter those reads to nothing — a failure that presents as "the case does
-- not exist" for everybody including its owner.
alter table public.cases enable row level security;
alter table public.case_collaborators enable row level security;

create policy cases_select on public.cases
  for select using (public.can_read_case(id));

create policy cases_insert on public.cases
  for insert with check (owner_id = auth.uid());

create policy cases_update on public.cases
  for update using (public.can_write_case(id)) with check (public.can_write_case(id));

-- Deleting a case is the owner's alone. An editor who can rewrite a dossier
-- still cannot destroy the investigation.
create policy cases_delete on public.cases
  for delete using (owner_id = auth.uid());

create policy collaborators_select on public.case_collaborators
  for select using (public.case_role_of(case_id, auth.uid()) is not null);

-- No insert, update or delete policy on case_collaborators, deliberately.
-- Membership changes go through an RPC, so "you cannot invite yourself",
-- "only an owner may grant owner" and "acceptance is the invitee's act" live
-- in one body instead of being scattered across three policies plus a trigger
-- that must agree with them.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Stated rather than inherited. A Supabase project grants these to its roles by
-- default, which means a migration that says nothing works there and fails
-- against the plain Postgres the verification script and CI use — and, worse,
-- leaves the actual permission surface implicit and unreviewable.
--
-- `anon` gets select only, and only reaches published cases: the select policy
-- is what narrows it, and there is no policy path granting a private case to
-- an unauthenticated caller.
grant select on public.cases to anon, authenticated;
grant insert, update, delete on public.cases to authenticated;
grant select on public.case_collaborators to authenticated;

-- Deliberately no insert/update/delete grant on case_collaborators for any
-- role but service_role. Membership changes belong in an RPC where the rules
-- can live in one body; a direct grant would let the client write rows the
-- policies alone cannot fully constrain.
grant select, insert, update, delete on public.case_collaborators to service_role;
grant select, insert, update, delete on public.cases to service_role;
