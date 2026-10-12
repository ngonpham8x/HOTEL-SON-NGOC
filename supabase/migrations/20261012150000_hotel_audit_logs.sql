-- Append-only, server-created journal. A business write and its journal entry
-- share the same PostgreSQL transaction, including retry/rollback semantics.
create table public.hotel_audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id text not null,
  actor_name text not null,
  actor_username text not null,
  actor_role text not null,
  action text not null,
  request_id text unique,
  revision bigint,
  details jsonb not null default '[]'::jsonb check (jsonb_typeof(details) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);
create index hotel_audit_logs_actor_id_id on public.hotel_audit_logs(actor_id, id desc);
create index hotel_audit_logs_action_id on public.hotel_audit_logs(action, id desc);
create index hotel_audit_logs_created_at on public.hotel_audit_logs(created_at desc);
alter table public.hotel_audit_logs enable row level security;
revoke all on public.hotel_audit_logs from public, anon, authenticated, service_role;
grant select, insert on public.hotel_audit_logs to service_role;
grant usage, select on sequence public.hotel_audit_logs_id_seq to service_role;

create function public.hotel_audit_actor(p_hash text) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare s hotel_sessions%rowtype; a hotel_staff%rowtype;
begin
  select * into s from hotel_sessions where token_hash = p_hash and auth_version = (select version from hotel_auth where id) and expires_at > now();
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  if s.staff_id is null then return jsonb_build_object('id','admin','name','Quản lý','username','admin','role','ADMIN'); end if;
  select * into a from hotel_staff where id = s.staff_id and active and version = s.staff_version;
  if not found then raise exception 'SESSION_EXPIRED'; end if;
  return jsonb_build_object('id',a.id,'name',a.display_name,'username',a.username,'role','RECEPTION');
end $$;

create function public.hotel_audit_fields(p_row jsonb) returns jsonb
language sql immutable security invoker set search_path = public, pg_temp as $$
  select coalesce((select jsonb_object_agg(key, value) from jsonb_each(coalesce(p_row,'{}'::jsonb)) where key = any(array[
    'number','name','category','price','unit','floor','typeName','maxGuests','status','cleanStatus',
    'roomNumber','checkInDate','checkInTime','checkOutDate','checkOutTime','expectedCheckOutDate','expectedCheckOutTime',
    'pricingType','rateApplied','pricePerNight','pricePerHour','allowsHourly','defaultCheckInTime','defaultCheckOutTime',
    'deposit','depositAmount','roomCharge','serviceCharge','massageCharge','surcharge','discount','depositDeducted',
    'refundAmount','totalAmount','paidAmount','debtAmount','originalDebt','remainingAmount','dueDate','paymentMethod','archived',
    'username','display_name','active','permissions','version'
  ])), '{}'::jsonb)
  || case when p_row ? 'services' then jsonb_build_object('services',
    (select coalesce(jsonb_agg(jsonb_build_object('name',value->'name','quantity',value->'quantity','unitPrice',value->'unitPrice','totalPrice',value->'totalPrice')), '[]'::jsonb) from jsonb_array_elements(p_row->'services'))
  ) else '{}'::jsonb end
  || case when p_row ? 'paymentHistory' then jsonb_build_object('paymentEvents',jsonb_array_length(p_row->'paymentHistory'),
    'lastPayment',jsonb_build_object('amount',p_row->'paymentHistory'->-1->'amount','method',p_row->'paymentHistory'->-1->'method','date',p_row->'paymentHistory'->-1->'date','time',p_row->'paymentHistory'->-1->'time')) else '{}'::jsonb end
  || case when p_row ? 'serviceLifecycle' then jsonb_build_object(
    'ticketEvents', jsonb_array_length(p_row->'serviceLifecycle'->'events'),
    'refundDue', p_row->'serviceLifecycle'->'refundDue',
    'refunded', (select coalesce(sum((value->>'amount')::bigint),0) from jsonb_array_elements(p_row->'serviceLifecycle'->'events') where value->>'kind'='REFUND'),
    'lastTicketEvent',jsonb_build_object('kind',p_row->'serviceLifecycle'->'events'->-1->'kind','amount',p_row->'serviceLifecycle'->'events'->-1->'amount',
      'method',p_row->'serviceLifecycle'->'events'->-1->'method','fee',p_row->'serviceLifecycle'->'events'->-1->'fee','requestedBy',p_row->'serviceLifecycle'->'events'->-1->'requestedBy',
      'items',(select coalesce(jsonb_agg(jsonb_build_object('name',s.usage->'name','quantity',i.item->'quantity')),'[]')
        from jsonb_array_elements(coalesce(p_row->'serviceLifecycle'->'events'->-1->'items','[]')) i(item)
        left join jsonb_array_elements(coalesce(p_row->'services','[]')) s(usage) on s.usage->>'id'=i.item->>'usageId'))
  ) else '{}'::jsonb end;
$$;

create function public.hotel_audit_business() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare actor jsonb; collection text; previous_row jsonb; next_row jsonb; changes jsonb := '[]'; counts jsonb := '{}'; n integer; op text;
begin
  if new.data is not distinct from old.data then return new; end if;
  actor := coalesce(nullif(current_setting('hotel.audit_actor',true),'')::jsonb, '{"id":"system","name":"Hệ thống","username":"system","role":"SYSTEM"}'::jsonb);
  op := coalesce(nullif(current_setting('hotel.audit_operation',true),''),'data.update');
  if op='sale.create' and exists (select 1 from jsonb_array_elements(new.data->'invoices') a join jsonb_array_elements(old.data->'invoices') b on a->>'id'=b->>'id'
    where jsonb_array_length(coalesce(a->'serviceLifecycle'->'events','[]'))>jsonb_array_length(coalesce(b->'serviceLifecycle'->'events','[]')) and a->'serviceLifecycle'->'events'->-1->>'kind'='USE') then op:='sale.use'; end if;
  foreach collection in array array['rooms','services','stays','reservations','invoices','debts'] loop
    n := 0;
    for previous_row, next_row in
      select b.row, a.row from (select value as row from jsonb_array_elements(coalesce(old.data->collection,'[]'))) b
      full join (select value as row from jsonb_array_elements(coalesce(new.data->collection,'[]'))) a on b.row->>'id'=a.row->>'id'
      where b.row is distinct from a.row
    loop
      n := n + 1;
      if jsonb_array_length(changes) < 100 then
        changes := changes || jsonb_build_array(jsonb_build_object(
          'collection',collection,'id',coalesce(next_row->>'id',previous_row->>'id'),
          'reference',coalesce(next_row->>'code',previous_row->>'code',next_row->>'number',previous_row->>'number',next_row->>'name',previous_row->>'name',next_row->>'roomNumber',previous_row->>'roomNumber',''),
          'kind',case when previous_row is null then 'CREATED' when next_row is null then 'DELETED' else 'UPDATED' end,
          'before',hotel_audit_fields(previous_row),'after',hotel_audit_fields(next_row)
        ));
      end if;
    end loop;
    if n > 0 then counts := counts || jsonb_build_object(collection,n); end if;
  end loop;
  insert into hotel_audit_logs(actor_id,actor_name,actor_username,actor_role,action,request_id,revision,details,metadata)
  values(actor->>'id',actor->>'name',actor->>'username',actor->>'role',op,nullif(current_setting('hotel.audit_request',true),''),new.revision,changes,jsonb_build_object('counts',counts));
  return new;
end $$;
create trigger hotel_audit_business_after_update after update of data on public.hotel_state for each row execute function public.hotel_audit_business();

create function public.hotel_audit_account() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare actor jsonb; b jsonb; a jsonb; op text;
begin
  actor := coalesce(nullif(current_setting('hotel.audit_actor',true),'')::jsonb, '{"id":"system","name":"Hệ thống","username":"system","role":"SYSTEM"}'::jsonb);
  if tg_op <> 'INSERT' then b := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and a is not distinct from b then return new; end if;
  op := case when tg_op='INSERT' then 'staff.create' when tg_op='DELETE' then 'staff.delete'
    when actor->>'id'=b->>'id' and b->'credential' is distinct from a->'credential' then 'staff.password' else 'staff.update' end;
  insert into hotel_audit_logs(actor_id,actor_name,actor_username,actor_role,action,details,metadata)
  values(actor->>'id',actor->>'name',actor->>'username',actor->>'role',op,
    jsonb_build_array(jsonb_build_object('collection','staff','id',coalesce(a->>'id',b->>'id'),'reference',coalesce(a->>'display_name',b->>'display_name'),
      'kind',case when tg_op='INSERT' then 'CREATED' when tg_op='DELETE' then 'DELETED' else 'UPDATED' end,'before',hotel_audit_fields(b),'after',hotel_audit_fields(a))),
    jsonb_build_object('passwordChanged',tg_op='UPDATE' and b->'credential' is distinct from a->'credential'));
  return coalesce(new,old);
end $$;
create trigger hotel_audit_staff_changes after insert or update or delete on public.hotel_staff for each row execute function public.hotel_audit_account();

create function public.hotel_audit_login() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare actor jsonb;
begin
  actor := hotel_audit_actor(new.token_hash);
  insert into hotel_audit_logs(actor_id,actor_name,actor_username,actor_role,action)
  values(actor->>'id',actor->>'name',actor->>'username',actor->>'role','auth.login');
  return new;
end $$;
create trigger hotel_audit_login_after_insert after insert on public.hotel_sessions for each row execute function public.hotel_audit_login();

create function public.hotel_audit_password() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare actor jsonb;
begin
  if new.primary_credential is not distinct from old.primary_credential then return new; end if;
  actor := coalesce(nullif(current_setting('hotel.audit_actor',true),'')::jsonb, '{"id":"system","name":"Hệ thống","username":"system","role":"SYSTEM"}'::jsonb);
  insert into hotel_audit_logs(actor_id,actor_name,actor_username,actor_role,action,metadata)
  values(actor->>'id',actor->>'name',actor->>'username',actor->>'role','auth.password','{"passwordChanged":true}');
  return new;
end $$;
create trigger hotel_audit_password_after_update after update on public.hotel_auth for each row execute function public.hotel_audit_password();

create function public.hotel_audit_immutable() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin raise exception 'AUDIT_IMMUTABLE'; end $$;
create trigger hotel_audit_no_rewrite before update or delete on public.hotel_audit_logs for each row execute function public.hotel_audit_immutable();

create function public.hotel_audit_list(p_hash text, p_actor_id text default null, p_action text default null, p_from timestamptz default null, p_to timestamptz default null, p_before_id text default null, p_limit integer default 50) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare entries jsonb; actors jsonb; actions jsonb; cursor text; amount integer := least(greatest(p_limit,1),100);
begin
  perform hotel_require_admin(p_hash);
  select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'createdAt',created_at,'actorId',actor_id,'actorName',actor_name,'actorUsername',actor_username,'actorRole',actor_role,
    'action',action,'requestId',request_id,'revision',revision,'details',details,'metadata',metadata) order by id desc),'[]') into entries
  from (select * from hotel_audit_logs where (p_actor_id is null or actor_id=p_actor_id) and (p_action is null or action=p_action)
    and (p_from is null or created_at>=p_from) and (p_to is null or created_at<p_to) and (p_before_id is null or id<p_before_id::bigint) order by id desc limit amount+1) page;
  if jsonb_array_length(entries)>amount then entries:=entries-amount; cursor:=entries->(amount-1)->>'id'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',actor_id,'name',actor_name,'username',actor_username) order by actor_name),'[]') into actors
    from (select distinct on (actor_id) actor_id,actor_name,actor_username from hotel_audit_logs order by actor_id,id desc) people;
  select coalesce(jsonb_agg(action order by action),'[]') into actions from (select distinct action from hotel_audit_logs) types;
  return jsonb_build_object('entries',entries,'actors',actors,'actions',actions,'nextCursor',cursor);
end $$;

create function public.hotel_staff_delete(p_hash text, p_id text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
begin perform hotel_require_admin(p_hash); delete from hotel_staff where id=p_id; return found; end $$;

create function public.hotel_logout(p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare actor jsonb;
begin
  if not exists(select 1 from hotel_sessions where token_hash=p_hash and expires_at>now()) then return false; end if;
  actor:=hotel_audit_actor(p_hash);
  delete from hotel_sessions where token_hash=p_hash;
  if not found then return false; end if;
  insert into hotel_audit_logs(actor_id,actor_name,actor_username,actor_role,action)
    values(actor->>'id',actor->>'name',actor->>'username',actor->>'role','auth.logout');
  return true;
end $$;

revoke all on function public.hotel_audit_actor(text), public.hotel_audit_fields(jsonb), public.hotel_audit_business(), public.hotel_audit_account(), public.hotel_audit_login(), public.hotel_audit_password(), public.hotel_audit_immutable(), public.hotel_audit_list(text,text,text,timestamptz,timestamptz,text,integer), public.hotel_staff_delete(text,text), public.hotel_logout(text) from public,anon,authenticated;
grant execute on function public.hotel_audit_actor(text), public.hotel_audit_fields(jsonb), public.hotel_audit_business(), public.hotel_audit_account(), public.hotel_audit_login(), public.hotel_audit_password(), public.hotel_audit_immutable(), public.hotel_audit_list(text,text,text,timestamptz,timestamptz,text,integer), public.hotel_staff_delete(text,text), public.hotel_logout(text) to service_role;

-- Set the authenticated actor inside each write transaction.
create or replace function public.hotel_require_admin(p_hash text) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for share;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now() and staff_id is null) then raise exception 'PERMISSION_DENIED'; end if;
  perform set_config('hotel.audit_actor',hotel_audit_actor(p_hash)::text,true);
end $$;

create or replace function public.hotel_save_authorized(p_revision bigint, p_data jsonb, p_hash text, p_request_id text, p_operation text, p_actor_version bigint) returns jsonb
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
  perform set_config('hotel.audit_actor',hotel_audit_actor(p_hash)::text,true);
  perform set_config('hotel.audit_operation',p_operation,true);
  perform set_config('hotel.audit_request',p_request_id,true);
  return hotel_save(p_revision, p_data, p_hash, p_request_id);
end $$;

create or replace function public.hotel_staff_change_password(p_hash text, p_version bigint, p_credential jsonb) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare session hotel_sessions%rowtype; account hotel_staff%rowtype; auth_version bigint;
begin
  select version into auth_version from hotel_auth where id for share;
  select * into session from hotel_sessions where token_hash = p_hash and expires_at > now();
  if session.staff_id is null or session.auth_version is distinct from auth_version then raise exception 'SESSION_EXPIRED'; end if;
  select * into account from hotel_staff where id = session.staff_id for update;
  if not found or not account.active or account.version is distinct from session.staff_version or account.version is distinct from p_version then raise exception 'SESSION_EXPIRED'; end if;
  perform set_config('hotel.audit_actor',hotel_audit_actor(p_hash)::text,true);
  update hotel_staff set credential = p_credential, version = version + 1, updated_at = now() where id = session.staff_id;
  delete from hotel_sessions where staff_id = session.staff_id;
  return true;
end $$;

create or replace function public.hotel_change_password(p_version bigint, p_credential jsonb, p_hash text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_version bigint;
begin
  select version into current_version from hotel_auth where id for update;
  if current_version is distinct from p_version then raise exception 'STALE_CREDENTIAL'; end if;
  if not exists (select 1 from hotel_sessions where token_hash = p_hash and auth_version = current_version and expires_at > now() and staff_id is null) then raise exception 'SESSION_EXPIRED'; end if;
  perform set_config('hotel.audit_actor',hotel_audit_actor(p_hash)::text,true);
  update hotel_auth set primary_credential = p_credential, version = version + 1 where id;
  delete from hotel_sessions;
  return true;
end $$;
