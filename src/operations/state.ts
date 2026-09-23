import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
export type OperationalState='RUNNING'|'PAUSED'|'STOPPED';
export async function getOperationalState(db:Db):Promise<OperationalState>{const row=(await db.execute(sql`SELECT state FROM operational_state WHERE id=true`)).rows[0] as any;return (row?.state??'RUNNING') as OperationalState}
export async function setOperationalState(db:Db,state:OperationalState,updatedBy='system'){await db.execute(sql`INSERT INTO operational_state(id,state,updated_by) VALUES(true,${state},${updatedBy}) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_by=excluded.updated_by,updated_at=now()`);return state}
export async function operationallyAllowed(db:Db,action:'DISCOVERY'|'RESEARCH'|'DRAFT'|'SEND'|'REPLY_POLL'|'SHEETS_SYNC'){const state=await getOperationalState(db);if(state==='RUNNING')return true;if(state==='PAUSED')return action==='REPLY_POLL'||action==='SHEETS_SYNC';return action==='SHEETS_SYNC'}
