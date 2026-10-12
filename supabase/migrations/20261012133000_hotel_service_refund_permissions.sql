-- Add explicit, opt-in ticket cancellation and refund permissions.
-- Existing accounts and granted permissions are preserved.
create or replace function public.hotel_staff_save(p_hash text, p_id text, p_create boolean, p_username text, p_display_name text, p_permissions jsonb, p_active boolean, p_credential jsonb, p_expected_version bigint) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare account hotel_staff%rowtype; result jsonb;
begin
  perform hotel_require_admin(p_hash);
  if jsonb_typeof(p_permissions->'views') is distinct from 'array' or jsonb_typeof(p_permissions->'actions') is distinct from 'array' then raise exception 'INVALID_PERMISSIONS'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_permissions->'views') view where view not in ('dashboard','rooms','reservations','stays','sales','debt','analytics','reports','services')) or exists (select 1 from jsonb_array_elements_text(p_permissions->'actions') action where action not in ('booking.create','booking.cancel','booking.archive','stay.checkin','stay.checkout','stay.guests','stay.service.add','stay.service.remove','room.clean','room.status','room.configure','room.delete','service.configure','service.delete','sale.create','sale.cancel','sale.refund','debt.collect','data.export')) then raise exception 'INVALID_PERMISSIONS'; end if;
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
