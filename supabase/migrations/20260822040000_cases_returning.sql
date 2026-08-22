-- A case could be inserted and never read back, so the app could not create one
-- at all.
--
-- The symptom was `new row violates row-level security policy for table
-- "cases"` on every attempt, which reads like a broken insert policy and is
-- not. The insert policy was always correct. Postgres applies the *select*
-- policy to the rows an `insert ... returning` hands back, and reports a
-- refusal there with the same message as a with-check violation — so the error
-- names the wrong policy. An insert with no `returning` succeeded throughout.
--
-- Why the select policy refused a row its owner had just written:
--
--   create policy cases_select on public.cases
--     for select using (public.can_read_case(id));
--
-- `can_read_case` resolves the caller's role by looking the case up *in
-- `cases`*. During the insert that row is not yet visible to that lookup, so
-- the owner branch finds nothing, the function returns false, and the row the
-- caller is holding is refused to the caller who just wrote it. Every
-- supabase-js `.insert().select()` asks for the representation, so this was
-- every case creation the app could make.
--
-- The fix reads ownership off the row in hand instead of going back to the
-- table for it. For a committed row the two are identical — `case_role_of`
-- returns 'owner' exactly when `owner_id = auth.uid()` — so this grants nobody
-- anything new; it only stops the owner's own row being invisible to the
-- statement that created it. It is also cheaper: the common case no longer
-- calls a function at all.
--
-- Rejected: dropping `.select()` from the client insert. It would have made the
-- error go away while leaving the policy unable to see a new row, and the next
-- table to derive its select policy from itself would have rediscovered this
-- from scratch.
--
-- The other tables are unaffected and stay as they are: `sources`, `claims`,
-- `evidence`, `events` and `contradictions` derive access from `can_read_case
-- (case_id)`, which reads a *different* table whose row is already committed.
-- `cases` was the only self-referential one. There is now a test inserting
-- into all six with `returning`, because the suite had only ever asserted that
-- the wrong owner is refused — and a policy that refuses everybody passes that.

drop policy if exists cases_select on public.cases;

create policy cases_select on public.cases
  for select using (owner_id = auth.uid() or public.can_read_case(id));
