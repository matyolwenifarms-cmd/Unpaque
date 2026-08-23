-- The case graph. Run after harness.sql and the migrations.
--
-- Two rules carry most of this file. An edge asserted as fact must name what
-- establishes it, and a symmetric relation is one row rather than two DASH
-- because a row per direction is how a graph ends up asserting that A knows B
-- while B has never heard of A.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(what text, got boolean) returns void
language plpgsql as $$
begin
  if not got then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

insert into auth.users (id, email) values
  ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'graph@example.org'),
  ('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'stranger@example.org')
on conflict (id) do nothing;

do $$
declare
  v_me     uuid := 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3';
  v_case   uuid;
  v_other  uuid;
  v_amy    uuid;
  v_ben    uuid;
  v_depot  uuid;
  v_source uuid;
  v_alien  uuid;
  v_claim  uuid;
  v_row    uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);

  insert into public.cases (owner_id, title) values (v_me, 'The depot') returning id into v_case;
  insert into public.sources (case_id, kind, title, retrieved_from, created_by)
  values (v_case, 'official_record', 'Gate log', 'https://example.org/log', v_me) returning id into v_source;
  insert into public.claims (case_id, statement) values (v_case, 'The van left before nine.')
  returning id into v_claim;

  insert into public.case_entities (case_id, kind, display_name, aliases, created_by)
  values (v_case, 'person', 'Amy Dlamini', array['A. Dlamini'], v_me) returning id into v_amy;
  insert into public.case_entities (case_id, kind, display_name, created_by)
  values (v_case, 'person', 'Ben Cole', v_me) returning id into v_ben;
  insert into public.case_entities (case_id, kind, display_name, latitude, longitude, precision, created_by)
  values (v_case, 'location', 'The depot', -26.204100, 28.047300, 'exact', v_me) returning id into v_depot;
  perform pg_temp.check('people, organisations and locations can be entered',
    v_amy is not null and v_depot is not null);
  perform pg_temp.check('and an alias is kept, which is how two records about one person meet',
    (select aliases[1] from public.case_entities where id = v_amy) = 'A. Dlamini');

  -- A latitude on a person is either a mistake or an unsourced claim about
  -- where they live.
  begin
    insert into public.case_entities (case_id, kind, display_name, latitude, longitude)
    values (v_case, 'person', 'Nowhere Person', 1.0, 1.0) returning id into v_row;
    perform pg_temp.check('a person carrying coordinates must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a person cannot carry coordinates', true);
  end;

  begin
    insert into public.case_entities (case_id, kind, display_name, latitude)
    values (v_case, 'location', 'Half a coordinate', 1.0) returning id into v_row;
    perform pg_temp.check('half a coordinate must be refused', false);
  exception when check_violation then
    perform pg_temp.check('a location cannot have a latitude and no longitude', true);
  end;

  -- The rule the edge table exists for.
  begin
    insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, status)
    values (v_case, 'contacted', v_amy, v_ben, 'fact') returning id into v_row;
    perform pg_temp.check('a fact with no source must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an edge asserted as fact must name what establishes it', true);
  end;

  insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, status, established_by, created_by)
  values (v_case, 'contacted', v_amy, v_ben, 'fact', v_source, v_me) returning id into v_row;
  perform pg_temp.check('and is accepted once it does', v_row is not null);

  insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, status, created_by)
  values (v_case, 'visited', v_ben, v_depot, 'inference', v_me);
  perform pg_temp.check('an inference may stand unsourced, and says so by its status',
    (select status from public.case_edges where relation = 'visited') = 'inference');

  -- Exclusive arcs. Exactly one endpoint of each kind.
  begin
    insert into public.case_edges (case_id, relation, source_entity_id, source_claim_id, target_entity_id)
    values (v_case, 'mentioned', v_amy, v_claim, v_ben) returning id into v_row;
    perform pg_temp.check('an edge with two source endpoints must be refused', false);
  exception when check_violation then
    perform pg_temp.check('an edge starts at exactly one thing', true);
  end;

  begin
    insert into public.case_edges (case_id, relation, source_entity_id)
    values (v_case, 'mentioned', v_amy) returning id into v_row;
    perform pg_temp.check('an edge with no target must be refused', false);
  exception when check_violation then
    perform pg_temp.check('and ends at exactly one thing', true);
  end;

  -- Edges across kinds, which is the point of the arcs.
  insert into public.case_edges (case_id, relation, source_source_id, target_claim_id, status, created_by)
  values (v_case, 'corroborates', v_source, v_claim, 'claim', v_me);
  -- Directed, and it has to stay directed: normalised as symmetric, the swap
  -- put the claim in the source position and lost which record was doing the
  -- corroborating.
  perform pg_temp.check('a source may corroborate a claim, and stays the one doing it',
    (select count(*) from public.case_edges
     where source_source_id = v_source and target_claim_id = v_claim) = 1);

  -- One row per relationship, not one per direction.
  begin
    insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, created_by)
    values (v_case, 'knows', v_amy, v_ben, v_me);
    insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, created_by)
    values (v_case, 'knows', v_ben, v_amy, v_me);
    perform pg_temp.check('the mirror of a symmetric edge must be refused', false);
  exception when unique_violation then
    perform pg_temp.check('a symmetric relation is one row, whichever way it is entered', true);
  end;

  -- A directed one is not the same fact in both directions.
  insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id, created_by)
  values (v_case, 'contacted', v_ben, v_amy, v_me);
  perform pg_temp.check('but a directed relation may run both ways, which is two facts',
    (select count(*) from public.case_edges where relation = 'contacted') = 2);

  -- Isolation.
  insert into public.cases (owner_id, title) values (v_me, 'Elsewhere') returning id into v_other;
  insert into public.case_entities (case_id, kind, display_name)
  values (v_other, 'person', 'Somebody else') returning id into v_alien;
  begin
    insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id)
    values (v_case, 'knows', v_amy, v_alien) returning id into v_row;
    perform pg_temp.check('an edge into another case must be refused', false);
  exception when foreign_key_violation then
    perform pg_temp.check('an edge cannot reach into another investigation', true);
  end;

  -- Deleting a node takes its edges.
  delete from public.case_entities where id = v_depot;
  perform pg_temp.check('deleting an entity deletes the edges touching it',
    (select count(*) from public.case_edges where target_entity_id = v_depot) = 0);

  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Negative controls
-- ---------------------------------------------------------------------------

do $$
declare
  v_me    uuid := 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3';
  v_them  uuid := 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4';
  v_case  uuid;
  v_amy   uuid;
  v_ben   uuid;
  v_row   uuid;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_me::text, true);
  insert into public.cases (owner_id, title) values (v_me, 'Private') returning id into v_case;
  insert into public.case_entities (case_id, kind, display_name)
  values (v_case, 'person', 'Amy') returning id into v_amy;
  insert into public.case_entities (case_id, kind, display_name)
  values (v_case, 'person', 'Ben') returning id into v_ben;
  insert into public.case_edges (case_id, relation, source_entity_id, target_entity_id)
  values (v_case, 'knows', v_amy, v_ben);

  perform set_config('request.jwt.claim.sub', v_them::text, true);
  perform pg_temp.check('a stranger sees no entities of a private case',
    (select count(*) from public.case_entities where case_id = v_case) = 0);
  perform pg_temp.check('nor any of its edges',
    (select count(*) from public.case_edges where case_id = v_case) = 0);

  begin
    insert into public.case_entities (case_id, kind, display_name)
    values (v_case, 'person', 'Theirs') returning id into v_row;
    perform pg_temp.check('a stranger adding an entity must be refused', false);
  exception when insufficient_privilege then
    perform pg_temp.check('a stranger cannot add an entity to somebody else''s case', true);
  end;

  reset role;
end $$;

do $$
begin
  perform pg_temp.check('the symmetric relations are settled in one place',
    public.relation_is_symmetric('knows') and not public.relation_is_symmetric('contacted'));
  perform pg_temp.check('case_edges has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'case_edges'));
  perform pg_temp.check('and does not force it',
    (select not relforcerowsecurity from pg_class where relname = 'case_edges'));

  -- Nothing scores a connection. A number beside a name in an investigation is
  -- read as suspicion, and the arithmetic knows nothing about the case.
  perform pg_temp.check('nothing weights or scores an edge',
    not exists (select 1 from information_schema.columns
                where table_name = 'case_edges'
                  and column_name in ('weight', 'score', 'strength', 'confidence', 'centrality')));
end $$;

do $$
begin
  begin
    perform pg_temp.check('control: this assertion must fail', false);
    raise exception 'NEGATIVE CONTROL FAILED: a false assertion was accepted';
  exception when others then
    if sqlerrm like 'NEGATIVE CONTROL FAILED%' then raise; end if;
    raise notice 'ok: the harness can fail (%)', sqlerrm;
  end;
end $$;

rollback;
