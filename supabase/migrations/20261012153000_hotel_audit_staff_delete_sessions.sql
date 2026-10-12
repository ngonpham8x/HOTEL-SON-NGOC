-- Revoke active sessions before removing a staff account. The audit trigger
-- keeps the account identity without a foreign key to the deleted row.
create or replace function public.hotel_staff_delete(p_hash text, p_id text) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform hotel_require_admin(p_hash);
  delete from hotel_sessions where staff_id=p_id;
  delete from hotel_staff where id=p_id;
  return found;
end $$;
