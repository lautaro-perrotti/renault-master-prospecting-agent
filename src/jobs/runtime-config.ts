import {sql} from 'drizzle-orm';
import type {Config} from '../config.js';
import type {Db} from '../db/client.js';
export async function effectiveMode(db:Db,config:Config){const row=(await db.execute(sql`SELECT value FROM configuration WHERE key='OUTREACH_MODE'`)).rows[0] as any;return row?.value&&['MANUAL','SEMI_AUTO','AUTO'].includes(row.value)?row.value as Config['OUTREACH_MODE']:config.OUTREACH_MODE}
