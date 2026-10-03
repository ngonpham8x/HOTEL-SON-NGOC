-- Only the Edge Function's service role can access hotel data or credentials.
create extension if not exists btree_gist with schema extensions;
create table public.hotel_auth (
  id boolean primary key default true check (id),
  version bigint not null default 1,
  primary_credential jsonb not null,
  fixed_credential jsonb not null
);
create table public.hotel_state (
  id boolean primary key default true check (id),
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.hotel_sessions (
  token_hash text primary key,
  auth_version bigint not null,
  expires_at timestamptz not null
);
create table public.hotel_login_limits (
  bucket text primary key,
  minute timestamptz not null,
  attempts integer not null
);
create table public.hotel_room_intervals (
  source_id text primary key,
  room_id text not null,
  period tstzrange not null check (not isempty(period)),
  exclude using gist (room_id with =, period with &&)
);
create table public.hotel_mutations (
  request_id text primary key,
  created_at timestamptz not null default now()
);
create index hotel_mutations_created_at on public.hotel_mutations(created_at);
alter table public.hotel_auth enable row level security;
alter table public.hotel_state enable row level security;
alter table public.hotel_sessions enable row level security;
alter table public.hotel_login_limits enable row level security;
alter table public.hotel_room_intervals enable row level security;
alter table public.hotel_mutations enable row level security;
revoke all on public.hotel_auth, public.hotel_state, public.hotel_sessions, public.hotel_login_limits, public.hotel_room_intervals, public.hotel_mutations from public, anon, authenticated;
grant all on public.hotel_auth, public.hotel_state, public.hotel_sessions, public.hotel_login_limits, public.hotel_room_intervals, public.hotel_mutations to service_role;

create function public.hotel_rate_limit(p_bucket text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare count_global integer; count_ip integer;
begin
  insert into hotel_login_limits values ('global', date_trunc('minute', now()), 1)
  on conflict (bucket) do update set minute = excluded.minute, attempts = case when hotel_login_limits.minute = excluded.minute then hotel_login_limits.attempts + 1 else 1 end returning attempts into count_global;
  insert into hotel_login_limits values (p_bucket, date_trunc('minute', now()), 1)
  on conflict (bucket) do update set minute = excluded.minute, attempts = case when hotel_login_limits.minute = excluded.minute then hotel_login_limits.attempts + 1 else 1 end returning attempts into count_ip;
  delete from hotel_login_limits where minute < now() - interval '1 day';
  return count_global <= 30 and count_ip <= 8;
end $$;

create function public.hotel_open_session(p_version bigint, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for share;
  if current_version is distinct from p_version then return false; end if;
  delete from hotel_sessions where expires_at <= now();
  insert into hotel_sessions values (p_hash, current_version, now() + interval '12 hours');
  return true;
end $$;

create function public.hotel_save(p_revision bigint, p_data jsonb, p_hash text, p_request_id text) returns jsonb
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
  delete from hotel_room_intervals;
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

create function public.hotel_change_password(p_version bigint, p_credential jsonb, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for update;
  if current_version is distinct from p_version then raise exception 'STALE_CREDENTIAL'; end if;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now()) then raise exception 'SESSION_EXPIRED'; end if;
  update hotel_auth set primary_credential = p_credential, version = version + 1 where id;
  delete from hotel_sessions;
  return true;
end $$;
revoke all on function public.hotel_rate_limit(text), public.hotel_open_session(bigint,text), public.hotel_save(bigint,jsonb,text,text), public.hotel_change_password(bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.hotel_rate_limit(text), public.hotel_open_session(bigint,text), public.hotel_save(bigint,jsonb,text,text), public.hotel_change_password(bigint,jsonb,text) to service_role;
