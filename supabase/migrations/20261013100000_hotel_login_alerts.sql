create table public.hotel_known_devices (device_hash text primary key, first_seen timestamptz not null default now());
create table public.hotel_login_alerts (id bigint generated always as identity primary key, created_at timestamptz not null default now(), actor_name text not null, device text not null, acknowledged_at timestamptz);
alter table public.hotel_known_devices enable row level security;
alter table public.hotel_login_alerts enable row level security;
revoke all on public.hotel_known_devices, public.hotel_login_alerts from public, anon, authenticated;
grant all on public.hotel_known_devices, public.hotel_login_alerts to service_role;
grant usage, select on sequence public.hotel_login_alerts_id_seq to service_role;
create function public.hotel_record_device(p_hash text, p_device_hash text, p_device text) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a jsonb; inserted integer;
begin
  a := hotel_audit_actor(p_hash);
  insert into hotel_known_devices(device_hash) values(p_device_hash) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=1 then
    insert into hotel_login_alerts(actor_name,device) values(a->>'name',left(p_device,300));
  end if;
end $$;
create function public.hotel_security_alerts(p_hash text, p_ack text default null) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a jsonb; result jsonb;
begin
  a := hotel_audit_actor(p_hash);
  if a->>'role'<>'ADMIN' then raise exception 'PERMISSION_DENIED'; end if;
  if p_ack is not null then update hotel_login_alerts set acknowledged_at=now() where id=p_ack::bigint and acknowledged_at is null; end if;
  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) into result from
    (select id::text,created_at,actor_name,device from hotel_login_alerts where acknowledged_at is null order by id desc limit 50) r;
  return result;
end $$;
revoke all on function public.hotel_record_device(text,text,text), public.hotel_security_alerts(text,text) from public,anon,authenticated;
grant execute on function public.hotel_record_device(text,text,text), public.hotel_security_alerts(text,text) to service_role;
