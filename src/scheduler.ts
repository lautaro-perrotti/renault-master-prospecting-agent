import {sql} from 'drizzle-orm';
import type {Config} from './config.js';
import type {Db} from './db/client.js';
import {enqueue} from './jobs/queue.js';
function matchesCron(expression:string,now:Date){const fields=expression.trim().split(/\s+/);if(fields.length<5)return false;const minute=fields[0];const hour=fields[1];const minuteOk=minute==='*'||minute.startsWith('*/')&&now.getMinutes()%Number(minute.slice(2))===0||minute.split(',').includes(String(now.getMinutes()));const hourOk=hour==='*'||hour.split(',').includes(String(now.getHours()));return minuteOk&&hourOk}
export async function schedulerTick(db:Db,config:Config,now=new Date()){
  const slot=now.toISOString().slice(0,16);const scheduled:Array<Promise<unknown>>=[];
  if(matchesCron(config.SCHEDULER_DISCOVERY_CRON,now))scheduled.push(enqueue(db,'DISCOVERY',{reason:'scheduled',slot},now,{idempotencyKey:`DISCOVERY:${slot}`}));
  if(matchesCron(config.SCHEDULER_REPLY_CRON,now))scheduled.push(enqueue(db,'CHECK_REPLIES',{reason:'scheduled',slot},now,{idempotencyKey:`CHECK_REPLIES:${slot}`}));
  if(matchesCron(config.SCHEDULER_FOLLOWUP_CRON,now))scheduled.push(enqueue(db,'FOLLOW_UP',{reason:'scheduled',slot},now,{idempotencyKey:`FOLLOW_UP:${slot}`}));
  if(matchesCron(config.SCHEDULER_SHEETS_CRON,now))scheduled.push(enqueue(db,'SHEETS_SYNC',{reason:'scheduled',slot},now,{idempotencyKey:`SHEETS_SYNC:${slot}`}));
  await Promise.all(scheduled);await db.execute(sql`INSERT INTO configuration(key,value) VALUES('SCHEDULER_HEARTBEAT',${now.toISOString()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);return scheduled.length;
}
export async function schedulerLoop(db:Db,config:Config,signal?:AbortSignal){while(!signal?.aborted){await schedulerTick(db,config);await new Promise(resolve=>setTimeout(resolve,60_000))}}
export {matchesCron};
