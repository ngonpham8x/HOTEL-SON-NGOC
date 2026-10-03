-- Staff credentials and permission changes are private to the Edge Function.
create table public.hotel_staff (
  id text primary key,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$' and username not in ('admin','manager','quanly')),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  active boolean not null default true,
  version bigint not null default 1,
  permissions jsonb not null,
  credential jsonb not null check (jsonb_typeof(credential) = 'object' and coalesce(credential->>'salt' ~ '^[a-f0-9]{32}$', false) and coalesce(credential->>'hash' ~ '^[a-f0-9]{64}$', false) and coalesce((credential->>'iterations')::integer = 210000, false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hotel_staff enable row level security;
revoke all on public.hotel_staff from public, anon, authenticated;
grant all on public.hotel_staff to service_role;
alter table public.hotel_sessions add column staff_id text references public.hotel_staff(id);
alter table public.hotel_sessions add column staff_version bigint;
alter table public.hotel_sessions add constraint hotel_session_identity check ((staff_id is null) = (staff_version is null));
create index hotel_sessions_staff_id on public.hotel_sessions(staff_id) where staff_id is not null;

create or replace function public.hotel_open_session(p_version bigint, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for share;
  if current_version is distinct from p_version then return false; end if;
  delete from hotel_sessions where expires_at <= now();
  insert into hotel_sessions(token_hash, auth_version, expires_at) values (p_hash, current_version, now() + interval '12 hours');
  return true;
end $$;

create function public.hotel_open_staff_session(p_id text, p_version bigint, p_auth_version bigint, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare account hotel_staff%rowtype; auth_version bigint;
begin
  select version into auth_version from hotel_auth where id for share;
  select * into account from hotel_staff where id = p_id for share;
  if auth_version is distinct from p_auth_version or account.version is distinct from p_version or not account.active then return false; end if;
  delete from hotel_sessions where expires_at <= now();
  insert into hotel_sessions(token_hash, auth_version, expires_at, staff_id, staff_version) values (p_hash, auth_version, now() + interval '12 hours', p_id, account.version);
  return true;
end $$;

create function public.hotel_require_admin(p_hash text) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for share;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now() and staff_id is null) then raise exception 'PERMISSION_DENIED'; end if;
end $$;

create function public.hotel_staff_save(p_hash text, p_id text, p_create boolean, p_username text, p_display_name text, p_permissions jsonb, p_active boolean, p_credential jsonb, p_expected_version bigint) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare account hotel_staff%rowtype; result jsonb;
begin
  perform hotel_require_admin(p_hash);
  if jsonb_typeof(p_permissions->'views') is distinct from 'array' or jsonb_typeof(p_permissions->'actions') is distinct from 'array' then raise exception 'INVALID_PERMISSIONS'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_permissions->'views') view where view not in ('dashboard','rooms','reservations','stays','sales','debt','analytics','reports','services')) or exists (select 1 from jsonb_array_elements_text(p_permissions->'actions') action where action not in ('booking.create','booking.cancel','booking.archive','stay.checkin','stay.checkout','stay.guests','stay.service.add','stay.service.remove','room.clean','room.status','room.configure','room.delete','service.configure','service.delete','sale.create','debt.collect','data.export')) then raise exception 'INVALID_PERMISSIONS'; end if;
  if p_create then
    if p_credential is null then raise exception 'PASSWORD_REQUIRED'; end if;
    insert into hotel_staff(id, username, display_name, permissions, active, credential) values (p_id, p_username, p_display_name, p_permissions, p_active, p_credential) returning * into account;
  else
    select * into account from hotel_staff where id = p_id for update;
    if not found then raise exception 'STAFF_NOT_FOUND'; end if;
    if account.version is distinct from p_expected_version then raise exception 'STALE_STAFF'; end if;
    update hotel_staff set username = p_username, display_name = p_display_name, permissions = p_permissions, active = p_active, credential = coalesce(p_credential, credential), version = version + 1, updated_at = now() where id = p_id returning * into account;
    delete from hotel_sessions where staff_id = p_id;
  end if;
  result := to_jsonb(account) - 'credential';
  return result;
end $$;

-- Hold a shared lock on staff permissions through the hotel transaction. A
-- simultaneous account edit/deactivation must finish before a new write can
-- authorize, or wait for a previously authorized write to finish.
create function public.hotel_save_authorized(p_revision bigint, p_data jsonb, p_hash text, p_request_id text, p_operation text, p_actor_version bigint) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare session hotel_sessions%rowtype; account hotel_staff%rowtype; current_auth_version bigint;
begin
  select version into current_auth_version from hotel_auth where id for share;
  select * into session from hotel_sessions where token_hash = p_hash and auth_version = current_auth_version and expires_at > now();
  -- A distinct variable name avoids ambiguity with the session version column.
  if session.token_hash is null or session.auth_version is distinct from current_auth_version then raise exception 'SESSION_EXPIRED'; end if;
  if session.staff_id is not null then
    select * into account from hotel_staff where id = session.staff_id for share;
    if not found or not account.active or account.version is distinct from session.staff_version or account.version is distinct from p_actor_version then raise exception 'SESSION_EXPIRED'; end if;
    if p_operation = 'data.restore' or not (account.permissions->'actions' ? p_operation) then raise exception 'PERMISSION_DENIED'; end if;
  elsif p_actor_version is distinct from current_auth_version then raise exception 'SESSION_EXPIRED'; end if;
  return hotel_save(p_revision, p_data, p_hash, p_request_id);
end $$;

create function public.hotel_staff_change_password(p_hash text, p_version bigint, p_credential jsonb) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare session hotel_sessions%rowtype; account hotel_staff%rowtype; auth_version bigint;
begin
  select version into auth_version from hotel_auth where id for share;
  select * into session from hotel_sessions where token_hash = p_hash and expires_at > now();
  if session.staff_id is null or session.auth_version is distinct from auth_version then raise exception 'SESSION_EXPIRED'; end if;
  select * into account from hotel_staff where id = session.staff_id for update;
  if not found or not account.active or account.version is distinct from session.staff_version or account.version is distinct from p_version then raise exception 'SESSION_EXPIRED'; end if;
  update hotel_staff set credential = p_credential, version = version + 1, updated_at = now() where id = session.staff_id;
  delete from hotel_sessions where staff_id = session.staff_id;
  return true;
end $$;

-- The old manager password RPC must never accept a staff session.
create or replace function public.hotel_change_password(p_version bigint, p_credential jsonb, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for update;
  if current_version is distinct from p_version then raise exception 'STALE_CREDENTIAL'; end if;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now() and staff_id is null) then raise exception 'SESSION_EXPIRED'; end if;
  update hotel_auth set primary_credential = p_credential, version = version + 1 where id;
  delete from hotel_sessions;
  return true;
end $$;
revoke all on function public.hotel_open_staff_session(text,bigint,bigint,text), public.hotel_require_admin(text), public.hotel_staff_save(text,text,boolean,text,text,jsonb,boolean,jsonb,bigint), public.hotel_save_authorized(bigint,jsonb,text,text,text,bigint), public.hotel_staff_change_password(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.hotel_open_staff_session(text,bigint,bigint,text), public.hotel_require_admin(text), public.hotel_staff_save(text,text,boolean,text,text,jsonb,boolean,jsonb,bigint), public.hotel_save_authorized(bigint,jsonb,text,text,text,bigint), public.hotel_staff_change_password(text,bigint,jsonb) to service_role;
