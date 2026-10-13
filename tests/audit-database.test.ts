import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { fixtureCredential } from './authFixture';

test('audit records share transactions, reject edits, preserve actors, filter and never expose credentials', async () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  const scalar = async (query: string, params: unknown[] = []) => (await pg.query<{ value: any }>(query, params)).rows[0].value;
  try {
    await pg.exec('create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;');
    for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) await pg.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    await pg.exec(readFileSync('supabase/seed.sql','utf8'));
    assert.equal(await scalar("select has_table_privilege('anon','hotel_audit_logs','select') as value"), false);
    assert.equal(await scalar("select has_table_privilege('authenticated','hotel_audit_logs','insert') as value"), false);
    assert.equal(await scalar("select has_table_privilege('service_role','hotel_audit_logs','delete') as value"), false);
    assert.equal(await scalar("select has_function_privilege('anon','hotel_audit_list(text,text,text,timestamptz,timestamptz,text,integer)','execute') as value"), false);
    const admin = 'a'.repeat(64), staff = 'b'.repeat(64), id = '11111111-1111-4111-8111-111111111111';
    await scalar('select hotel_open_session(1,$1) as value',[admin]);
    const permissions = { views: ['rooms'], actions: ['room.clean'] };
    const saveStaff = (version: number | null, name: string) => scalar('select hotel_staff_save($1,$2,$3,$4,$5,$6::jsonb,true,$7::jsonb,$8) as value',[admin,id,version === null,'audit.staff',name,JSON.stringify(permissions),version === null ? JSON.stringify(fixtureCredential) : null,version]);
    await saveStaff(null,'Lễ tân trước đổi tên');
    await scalar('select hotel_open_staff_session($1,1,1,$2) as value',[id,staff]);
    await scalar('select hotel_record_device($1,$2,$3) as value',[staff,'device-one','Test browser']);
    await scalar('select hotel_record_device($1,$2,$3) as value',[staff,'device-one','Test browser']);
    assert.equal(await scalar('select count(*)::integer as value from hotel_login_alerts'),1,'known device does not duplicate alerts');
    await assert.rejects(scalar('select hotel_security_alerts($1) as value',[staff]), /PERMISSION_DENIED/);
    await assert.rejects(scalar('select hotel_record_device($1,$2,$3) as value',['invalid','device-two','Browser']), /SESSION_EXPIRED/);
    const alerts = await scalar('select hotel_security_alerts($1) as value',[admin]);
    assert.equal(alerts.length,1);
    assert.equal(alerts[0].device,'Test browser');
    assert.deepEqual(await scalar('select hotel_security_alerts($1,$2) as value',[admin,alerts[0].id]),[]);
    assert.equal(await scalar("select has_table_privilege('anon','hotel_login_alerts','select') as value"),false);
    const initial = await scalar('select data as value from hotel_state');
    const next = structuredClone(initial); next.rooms[0].cleanStatus = 'DIRTY';
    const request = 'c'.repeat(32);
    await scalar('select hotel_save_authorized(0,$1::jsonb,$2,$3,$4,1) as value',[JSON.stringify(next),staff,request,'room.clean']);
    const business = await scalar("select to_jsonb(a) as value from hotel_audit_logs a where action='room.clean'");
    assert.equal(business.actor_id,id); assert.equal(business.actor_name,'Lễ tân trước đổi tên'); assert.equal(business.actor_role,'RECEPTION');
    assert.equal(business.request_id,request); assert.equal(business.revision,1);
    assert.equal(business.details[0].before.cleanStatus,'CLEAN'); assert.equal(business.details[0].after.cleanStatus,'DIRTY');
    const count = await scalar('select count(*)::integer as value from hotel_audit_logs');
    await scalar('select hotel_save_authorized(0,$1::jsonb,$2,$3,$4,1) as value',[JSON.stringify(next),staff,request,'room.clean']);
    assert.equal(await scalar('select count(*)::integer as value from hotel_audit_logs'),count,'retry cannot duplicate evidence');
    const conflicting = { ...next, reservations: [
      { id:'a',roomId:next.rooms[0].id,status:'CONFIRMED',checkInDate:'2099-10-12',checkInTime:'14:00',checkOutDate:'2099-10-14',checkOutTime:'12:00' },
      { id:'b',roomId:next.rooms[0].id,status:'CONFIRMED',checkInDate:'2099-10-13',checkInTime:'14:00',checkOutDate:'2099-10-15',checkOutTime:'12:00' },
    ] };
    await assert.rejects(scalar('select hotel_save_authorized(1,$1::jsonb,$2,$3,$4,1) as value',[JSON.stringify(conflicting),admin,'d'.repeat(32),'booking.create']));
    assert.equal(await scalar('select count(*)::integer as value from hotel_audit_logs'),count,'failed write also rolls its audit back');
    await assert.rejects(scalar('select hotel_audit_list($1) as value',[staff]), /PERMISSION_DENIED/);
    const filtered = await scalar('select hotel_audit_list($1,$2,$3) as value',[admin,id,'room.clean']);
    assert.equal(filtered.entries.length,1); assert.equal(filtered.entries[0].actorName,'Lễ tân trước đổi tên');
    const future = await scalar("select hotel_audit_list($1,null,null,'2099-01-01','2099-02-01') as value",[admin]); assert.equal(future.entries.length,0);
    const first = await scalar('select hotel_audit_list($1,null,null,null,null,null,1) as value',[admin]);
    assert.equal(first.entries.length,1); assert.ok(first.nextCursor);
    const second = await scalar('select hotel_audit_list($1,null,null,null,null,$2,1) as value',[admin,first.nextCursor]);
    assert.notEqual(second.entries[0].id,first.entries[0].id);
    await saveStaff(1,'Lễ tân sau đổi tên');
    const renamedSession = 'e'.repeat(64);
    await scalar('select hotel_open_staff_session($1,2,1,$2) as value',[id,renamedSession]);
    await scalar('select hotel_staff_delete($1,$2) as value',[admin,id]);
    assert.equal(await scalar('select count(*)::integer as value from hotel_sessions where staff_id=$1',[id]),0,'deletion also revokes the active renamed session');
    const retained = await scalar('select hotel_audit_list($1,$2) as value',[admin,id]);
    assert.ok(retained.entries.some((entry: any) => entry.actorName==='Lễ tân trước đổi tên'));
    assert.ok(retained.actors.some((actor: any) => actor.id===id),'deleted accounts remain filterable');
    const dump = JSON.stringify(await scalar('select hotel_audit_list($1) as value',[admin]));
    for (const secret of [admin,staff,renamedSession,fixtureCredential.salt,fixtureCredential.hash,'token_hash','primary_credential','credential']) assert.equal(dump.includes(secret),false,`journal excludes ${secret.slice(0,10)}`);
    await assert.rejects(pg.exec("delete from hotel_audit_logs where action='room.clean'"),/AUDIT_IMMUTABLE/);
    await assert.rejects(pg.exec("update hotel_audit_logs set actor_name='fake'"),/AUDIT_IMMUTABLE/);
    await scalar('select hotel_logout($1) as value',[admin]);
    assert.equal(await scalar("select count(*)::integer as value from hotel_audit_logs where action='auth.logout' and actor_id='admin'"),1);
  } finally { await pg.close(); }
});
