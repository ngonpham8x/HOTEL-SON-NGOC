-- PostgREST enables safeupdate: every DELETE needs an explicit condition.
-- Both columns are primary keys, so these predicates retain the intended full
-- interval rebuild and global session revocation without disabling protection.

create or replace function public.hotel_save(p_revision bigint, p_data jsonb, p_hash text, p_request_id text) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_revision bigint; current_version bigint; previous_data jsonb; item jsonb; start_at timestamptz; end_at timestamptz; result jsonb;
begin
  select version into current_version from hotel_auth where id for share;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now()) then raise exception 'SESSION_EXPIRED'; end if;
  select revision, data into current_revision, previous_data from hotel_state where id for update;
  if exists (select 1 from hotel_mutations where request_id = p_request_id) then
    select jsonb_build_object('revision', revision, 'data', data) into result from hotel_state where id;
    return result;
  end if;
  if current_revision is distinct from p_revision then raise exception 'STALE_REVISION'; end if;
  -- Rebuild under the same row lock. Exclusion constraints reject overlapping ranges atomically.
  delete from hotel_room_intervals where source_id is not null;
  for item in select value from jsonb_array_elements(p_data->'reservations') where value->>'status' = 'CONFIRMED' loop
    start_at := ((item->>'checkInDate') || 'T' || (item->>'checkInTime') || ':00+07:00')::timestamptz;
    end_at := ((item->>'checkOutDate') || 'T' || (item->>'checkOutTime') || ':00+07:00')::timestamptz;
    if end_at <= start_at then raise exception 'INVALID_PERIOD'; end if;
    -- Preserve existing future bookings if an earlier guest becomes overdue.
    -- Only a newly held/changed period must be rejected until that guest leaves.
    if not exists (
      select 1 from jsonb_array_elements(previous_data->'reservations') old
      where old->>'status' = 'CONFIRMED' and jsonb_build_array(old->>'id', old->>'roomId', old->>'checkInDate', old->>'checkInTime', old->>'checkOutDate', old->>'checkOutTime') = jsonb_build_array(item->>'id', item->>'roomId', item->>'checkInDate', item->>'checkInTime', item->>'checkOutDate', item->>'checkOutTime')
    ) and exists (
      select 1 from jsonb_array_elements(p_data->'stays') stay
      where stay->>'status' = 'ACTIVE' and stay->>'roomId' = item->>'roomId'
        and ((stay->>'expectedCheckOutDate') || 'T' || (stay->>'expectedCheckOutTime') || ':00+07:00')::timestamptz <= now()
        and end_at > ((stay->>'checkInDate') || 'T' || (stay->>'checkInTime') || ':00+07:00')::timestamptz
    ) then raise exception 'OVERDUE_STAY'; end if;
    insert into hotel_room_intervals values ('reservation:' || (item->>'id'), item->>'roomId', tstzrange(start_at, end_at, '[)'));
  end loop;
  for item in select value from jsonb_array_elements(p_data->'stays') where value->>'status' = 'ACTIVE' loop
    start_at := ((item->>'checkInDate') || 'T' || (item->>'checkInTime') || ':00+07:00')::timestamptz;
    end_at := ((item->>'expectedCheckOutDate') || 'T' || (item->>'expectedCheckOutTime') || ':00+07:00')::timestamptz;
    if end_at <= start_at then raise exception 'INVALID_PERIOD'; end if;
    if end_at <= now() and not exists (
      select 1 from jsonb_array_elements(previous_data->'stays') old
      where old->>'status' = 'ACTIVE' and jsonb_build_array(old->>'id', old->>'roomId', old->>'checkInDate', old->>'checkInTime', old->>'expectedCheckOutDate', old->>'expectedCheckOutTime') = jsonb_build_array(item->>'id', item->>'roomId', item->>'checkInDate', item->>'checkInTime', item->>'expectedCheckOutDate', item->>'expectedCheckOutTime')
    ) then end_at := 'infinity'::timestamptz; end if;
    insert into hotel_room_intervals values ('stay:' || (item->>'id'), item->>'roomId', tstzrange(start_at, end_at, '[)'));
  end loop;
  update hotel_state set revision = revision + 1, data = p_data, updated_at = now() where id returning jsonb_build_object('revision', revision, 'data', data) into result;
  insert into hotel_mutations(request_id) values (p_request_id);
  delete from hotel_mutations where created_at < now() - interval '2 days';
  return result;
end $$;

create or replace function public.hotel_change_password(p_version bigint, p_credential jsonb, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for update;
  if current_version is distinct from p_version then raise exception 'STALE_CREDENTIAL'; end if;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now() and staff_id is null) then raise exception 'SESSION_EXPIRED'; end if;
  update hotel_auth set primary_credential = p_credential, version = version + 1 where id;
  delete from hotel_sessions where token_hash is not null;
  return true;
end $$;
