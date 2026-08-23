-- RESEARCH, §7. A second coder, and coding blind until there is something to
-- compare.
--
-- Inter-coder agreement is the point of this migration, and it is worth being
-- explicit that the interesting half is not the arithmetic. Kappa measures
-- whether two people applying the same codebook to the same text reach the
-- same places. If the second coder can see the first coder's highlights while
-- they work, they reach the same places because they were shown them, and the
-- figure that comes out is a measure of nothing.
--
-- So a study is **blind** until its owner says otherwise: every coder sees
-- only their own codings. Unblinding is a deliberate act, it is one-way, and
-- it is what makes agreement computable.

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'study_role') then
    -- Two, and no 'owner'. Ownership is a column on `studies` and duplicating
    -- it here would make it possible to represent a study whose owner row says
    -- one thing and whose owner_id says another.
    create type public.study_role as enum ('coder', 'viewer');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

-- Keyed by email rather than by user id, which is a departure from
-- `case_collaborators` and is deliberate.
--
-- Resolving an email to a user id at invitation time means an RPC that reports
-- whether an account exists — and any authenticated person could then
-- enumerate the accounts on the instance by inviting addresses to a study of
-- their own and reading which ones succeeded. Recording the address instead
-- leaks nothing, and it also lets a researcher invite a colleague who has not
-- signed up yet, which is the ordinary case.
create table if not exists public.study_coders (
  study_id uuid not null references public.studies(id) on delete cascade,
  -- Lower-cased on the way in by invite_coder(); the constraint is what keeps
  -- that true if anything else ever writes here.
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  role public.study_role not null default 'coder',
  -- Null until the invitation is accepted. Resolved from the caller's own
  -- token at that point, never from anything the inviter supplied.
  user_id uuid references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (study_id, email),
  -- An accepted row must know who accepted it. The pair is what every access
  -- check reads, and a half-filled one would grant access to nobody while
  -- looking like it grants it to somebody.
  constraint study_coders_accepted_has_user
    check ((accepted_at is null) = (user_id is null))
);

comment on table public.study_coders is
  'Who else may code a study. A row without accepted_at is an invitation and grants nothing.';

create index if not exists study_coders_user_idx
  on public.study_coders (user_id) where accepted_at is not null;

-- ---------------------------------------------------------------------------
-- Blind coding
-- ---------------------------------------------------------------------------

alter table public.studies
  add column if not exists blind_coding boolean not null default true;

comment on column public.studies.blind_coding is
  'While true every coder sees only their own codings. One-way: unblinding cannot be undone, because nobody can be made to unsee.';

-- One-way, enforced rather than documented.
--
-- Re-blinding would be a claim about what the coders had seen, and it would be
-- false — the second coder who has already looked at the first coder's
-- highlights cannot be returned to not having looked. A study that could flip
-- back and forth would let a methods section say "coded independently" about
-- coding that was not.
create or replace function public.studies_blinding_is_one_way()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.blind_coding = false and new.blind_coding = true then
    raise exception 'unblinding cannot be undone: a coder who has seen the other codings cannot be returned to not having seen them'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.studies_blinding_is_one_way() from public;

drop trigger if exists studies_blinding_one_way on public.studies;
create trigger studies_blinding_one_way
  before update of blind_coding on public.studies
  for each row execute function public.studies_blinding_is_one_way();

-- ---------------------------------------------------------------------------
-- Access, widened
-- ---------------------------------------------------------------------------

-- `create or replace`, deliberately not dropped first: eleven policies already
-- depend on these, and an earlier migration can never safely drop a function
-- that policies attach to. The return type is unchanged, which is what makes
-- replace sufficient.
--
-- This is the change the previous migration said this function existed for.
create or replace function public.can_read_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studies s where s.id = p_study and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.study_coders sc
    where sc.study_id = p_study
      and sc.user_id = auth.uid()
      and sc.accepted_at is not null
  );
$$;

create or replace function public.can_write_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studies s where s.id = p_study and s.owner_id = auth.uid()
  ) or exists (
    select 1 from public.study_coders sc
    where sc.study_id = p_study
      and sc.user_id = auth.uid()
      and sc.accepted_at is not null
      and sc.role = 'coder'
  );
$$;

-- Only the owner may change the codebook, the transcripts or the study itself.
-- A second coder applies the codebook; a second coder who can rewrite it while
-- coding is not a second coder, and the agreement figure would be measuring a
-- moving target.
create or replace function public.owns_study(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.studies s where s.id = p_study and s.owner_id = auth.uid()
  );
$$;

revoke all on function public.owns_study(uuid) from public;
grant execute on function public.owns_study(uuid) to authenticated, service_role;

create or replace function public.study_is_blind(p_study uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.blind_coding from public.studies s where s.id = p_study), true);
$$;

revoke all on function public.study_is_blind(uuid) from public;
grant execute on function public.study_is_blind(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Inviting, accepting, unblinding
-- ---------------------------------------------------------------------------

drop function if exists public.invite_coder(uuid, text, public.study_role);

create or replace function public.invite_coder(
  p_study uuid,
  p_email text,
  p_role public.study_role default 'coder'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.owns_study(p_study) then
    raise exception 'only the owner of a study may invite a coder'
      using errcode = 'insufficient_privilege';
  end if;
  if position('@' in v_email) < 2 then
    raise exception 'that is not an email address' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.studies s where s.id = p_study and s.owner_id in (
    select u.id from auth.users u where lower(u.email) = v_email
  )) then
    raise exception 'you already own this study' using errcode = 'check_violation';
  end if;

  -- Re-inviting is not an error and must not clear an acceptance: somebody who
  -- has already accepted and is halfway through coding would otherwise lose
  -- access the moment the owner clicked invite twice.
  insert into public.study_coders (study_id, email, role, invited_by)
  values (p_study, v_email, p_role, auth.uid())
  on conflict (study_id, email) do nothing;
end;
$$;

revoke all on function public.invite_coder(uuid, text, public.study_role) from public;
grant execute on function public.invite_coder(uuid, text, public.study_role) to authenticated, service_role;

drop function if exists public.accept_coder_invitation(uuid);

-- The caller's own address, out of their own token. Nothing the inviter typed
-- decides who is granted access — an invitation names an address, and only the
-- person holding that address can turn it into a grant.
create or replace function public.accept_coder_invitation(p_study uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_email text;
begin
  if v_me is null then
    raise exception 'you are not signed in' using errcode = 'insufficient_privilege';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_me;

  update public.study_coders sc
  set user_id = v_me, accepted_at = now()
  where sc.study_id = p_study
    and sc.email = v_email
    and sc.accepted_at is null;

  return found;
end;
$$;

revoke all on function public.accept_coder_invitation(uuid) from public;
grant execute on function public.accept_coder_invitation(uuid) to authenticated, service_role;

drop function if exists public.pending_invitations();

-- What an invited person can see before they accept.
--
-- Needed because an unaccepted invitation grants no read on `studies` — which
-- is the point of it — so the invitee's own row in study_coders is all they
-- can select, and it carries a study id and nothing a person could recognise.
-- Being told "you have been invited to 8f3a-…" is not being told anything.
--
-- Dropped before create because it returns a table: `create or replace` cannot
-- change the output shape of a set-returning function in either direction, and
-- the migration that only works on an empty database passes its first run.
create or replace function public.pending_invitations()
returns table (study_id uuid, title text, invited_by_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, inviter.email
  from public.study_coders sc
  join public.studies s on s.id = sc.study_id
  left join auth.users inviter on inviter.id = sc.invited_by
  where sc.accepted_at is null
    and sc.email = (select lower(u.email) from auth.users u where u.id = auth.uid());
$$;

revoke all on function public.pending_invitations() from public;
grant execute on function public.pending_invitations() to authenticated, service_role;

drop function if exists public.unblind_study(uuid);

-- Deliberate, owner-only, and one-way. It is what makes agreement computable,
-- and it is the point after which nobody in the study is coding independently
-- any more.
create or replace function public.unblind_study(p_study uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_study(p_study) then
    raise exception 'only the owner of a study may unblind it'
      using errcode = 'insufficient_privilege';
  end if;
  update public.studies set blind_coding = false, updated_at = now() where id = p_study;
end;
$$;

revoke all on function public.unblind_study(uuid) from public;
grant execute on function public.unblind_study(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table public.study_coders enable row level security;

drop policy if exists study_coders_select on public.study_coders;
drop policy if exists study_coders_insert on public.study_coders;
drop policy if exists study_coders_delete on public.study_coders;

-- Readable by the study's people, and by the invited person so that a pending
-- invitation can be shown to them at all.
create policy study_coders_select on public.study_coders
  for select using (
    public.can_read_study(study_id)
    or email = (select lower(u.email) from auth.users u where u.id = auth.uid())
  );

-- No insert policy. invite_coder() is the only way in, because the row has to
-- be lower-cased, checked against the study's owner and written with an
-- invited_by the caller cannot choose.
create policy study_coders_delete on public.study_coders
  for delete using (public.owns_study(study_id));

-- Widened to match. The previous migration wrote this policy when a study had
-- exactly one person, so it reads owner_id directly — which left an accepted
-- coder able to read a study's transcripts and codebook (those policies go
-- through can_read_study) while the study row itself came back empty. The
-- symptom is a coder who accepts an invitation and is told the study does not
-- exist.
--
-- No recursion: can_read_study is security definer, so its read of `studies`
-- runs as the owner and is not subject to this policy.
--
-- `owner_id = auth.uid()` first, and it is not redundant. `insert ...
-- returning` applies the select policy to the row it hands back, and
-- can_read_study is STABLE — it sees the snapshot from the start of the
-- statement, which does not contain the row that statement is inserting. With
-- only the function call there, creating a study fails with "new row violates
-- row-level security policy", which names the insert policy and is not about
-- the insert policy at all. This is the same defect that stopped Detect
-- creating cases for a whole session; the branch is what fixed it there too.
drop policy if exists studies_select on public.studies;
create policy studies_select on public.studies
  for select using (owner_id = auth.uid() or public.can_read_study(id));

-- Update and delete stay with the owner. A coder renaming or deleting the
-- study they were invited to code is not a thing that should be possible.
drop policy if exists studies_update on public.studies;
create policy studies_update on public.studies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- The blind rule.
--
-- Replacing the policy from the previous migration rather than adding to it:
-- two select policies on one table are OR-ed, so an extra one can only ever
-- widen access, and what is wanted here is narrower.
drop policy if exists codings_select on public.codings;
create policy codings_select on public.codings
  for select using (
    public.can_read_study(study_id)
    and (coder_id = auth.uid() or not public.study_is_blind(study_id))
  );

-- A coder may remove their own codings and nobody else's. The owner cannot
-- delete a second coder's work either: agreement computed after the owner has
-- tidied the other coder's codings is not agreement.
drop policy if exists codings_delete on public.codings;
create policy codings_delete on public.codings
  for delete using (public.can_write_study(study_id) and coder_id = auth.uid());

-- The codebook and the transcripts belong to the owner. A second coder applies
-- them; changing them mid-study makes the agreement figure meaningless.
drop policy if exists codes_insert on public.codes;
drop policy if exists codes_update on public.codes;
drop policy if exists codes_delete on public.codes;
create policy codes_insert on public.codes
  for insert with check (public.owns_study(study_id));
create policy codes_update on public.codes
  for update using (public.owns_study(study_id)) with check (public.owns_study(study_id));
create policy codes_delete on public.codes
  for delete using (public.owns_study(study_id));

drop policy if exists study_documents_insert on public.study_documents;
drop policy if exists study_documents_update on public.study_documents;
drop policy if exists study_documents_delete on public.study_documents;
create policy study_documents_insert on public.study_documents
  for insert with check (public.owns_study(study_id));
create policy study_documents_update on public.study_documents
  for update using (public.owns_study(study_id)) with check (public.owns_study(study_id));
create policy study_documents_delete on public.study_documents
  for delete using (public.owns_study(study_id));

grant select, delete on public.study_coders to authenticated;
