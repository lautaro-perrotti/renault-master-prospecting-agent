import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
export async function reserveSendSlots(db:Db,messageId:string,dailyLimit:number,hourlyLimit:number){
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('renault-outreach-send-limits'))`);
    const daily=await tx.execute(sql`SELECT count(*)::int AS count FROM outreach_send_reservations WHERE scope='DAILY' AND period=current_date::text`);
    const hourly=await tx.execute(sql`SELECT count(*)::int AS count FROM outreach_send_reservations WHERE scope='HOURLY' AND period=date_trunc('hour',now())::text`);
    const existing=await tx.execute(sql`SELECT count(*)::int AS count FROM outreach_send_reservations WHERE message_id=${messageId}`);if(Number((existing.rows[0] as any).count)>0)return true;
    if(Number((daily.rows[0] as any).count)>=dailyLimit||Number((hourly.rows[0] as any).count)>=hourlyLimit)throw new Error('OUTREACH_LIMIT_REACHED');
    await tx.execute(sql`INSERT INTO outreach_send_reservations(message_id,period,scope) VALUES(${messageId},current_date::text,'DAILY'),(${messageId},date_trunc('hour',now())::text,'HOURLY')`);return true;
  });
}
