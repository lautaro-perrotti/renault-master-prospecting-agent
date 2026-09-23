import {sql} from 'drizzle-orm';
import type {Db} from '../db/client.js';
import {audit} from '../audit.js';
import {createSuppression} from '../outreach/suppression.js';
import {enqueue} from '../jobs/queue.js';
import {setOperationalState,type OperationalState} from '../operations/state.js';
export class LeadActions{
  constructor(private db:Db){}
  async research(companyId:string){return enqueue(this.db,'RESEARCH',{companyId},new Date(),{idempotencyKey:`RESEARCH:${companyId}`})}
  async skip(companyId:string,reason='OTHER'){await this.db.execute(sql`UPDATE companies SET status='DISCARDED',updated_at=now() WHERE id=${companyId} AND status NOT IN ('BLOCKED','SENT','REPLIED')`);await audit(this.db,'LEAD_SKIPPED',{reason},companyId)}
  async block(companyId:string,reason='OTHER'){await this.db.execute(sql`UPDATE companies SET status='BLOCKED',updated_at=now() WHERE id=${companyId}`);await createSuppression(this.db,{companyId,reason:`BLOCK:${reason}`});await audit(this.db,'LEAD_BLOCKED',{reason},companyId)}
  async send(companyId:string,approvedBy:string){const message=(await this.db.execute(sql`SELECT id FROM messages WHERE company_id=${companyId} AND outbound_state IN ('READY','DRAFT','FAILED') ORDER BY sequence_step NULLS LAST,id LIMIT 1`)).rows[0] as any;if(!message)throw new Error('NO_SENDABLE_MESSAGE');return enqueue(this.db,'SEND',{companyId,messageId:message.id,approvedBy},new Date(),{idempotencyKey:`SEND:${message.id}`})}
  async state(state:OperationalState,by:string){return setOperationalState(this.db,state,by)}
}
