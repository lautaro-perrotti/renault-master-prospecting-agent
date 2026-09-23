import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {GmailClient} from '../../outreach/gmail.js';
import {canSend} from '../../outreach/policy.js';
import {getSuppressionDecision} from '../../outreach/suppression.js';
import {reserveSendSlots} from '../../outreach/reservation.js';
import {effectiveMode} from '../runtime-config.js';
import {getOperationalState} from '../../operations/state.js';
import type {JobDependencies} from '../dependencies.js';

function uncertain(error:unknown){const message=String(error);return /timeout|timed out|ECONNRESET|socket|5\d\d/i.test(message)}
export async function sendHandler(db:Db,config:Config,job:any,deps:JobDependencies){
  if(!config.OUTREACH_ENABLED)throw new Error('OUTREACH_DISABLED');
  if(await getOperationalState(db)!=='RUNNING')throw new Error('SYSTEM_NOT_RUNNING');
  const messageId=String(job.payload.messageId??'');if(!messageId)throw new Error('SEND_REQUIRES_MESSAGE_ID');
  const message=(await db.execute(sql`SELECT m.*,c.status AS company_status,c.domain,q.total,q.decision FROM messages m JOIN companies c ON c.id=m.company_id LEFT JOIN LATERAL (SELECT total,decision FROM qualifications WHERE company_id=m.company_id ORDER BY created_at DESC LIMIT 1) q ON true WHERE m.id=${messageId}`)).rows[0] as any;if(!message)throw new Error('MESSAGE_NOT_FOUND');
  if(message.outbound_state==='SENT')return message;if(['SENDING','RECONCILING'].includes(message.outbound_state))throw new Error('OUTBOUND_RECONCILIATION_REQUIRED');if(message.outbound_state==='CANCELLED')throw new Error('MESSAGE_CANCELLED');
  const mode=await effectiveMode(db,config);const approved=Boolean(job.payload.approvedBy);if(!canSend({mode,score:Number(message.total??0),autoThreshold:config.AUTO_SEND_THRESHOLD,reviewThreshold:config.REVIEW_THRESHOLD,approved,followUp:Boolean(job.payload.followUp)}))throw new Error('MANUAL_APPROVAL_REQUIRED');
  const suppression=await getSuppressionDecision(db,message.company_id,message.to_email,message.domain);if(suppression.suppressed)throw new Error(`SUPPRESSED:${suppression.reasons.join(',')}`);
  await reserveSendSlots(db,message.id,config.DAILY_SEND_LIMIT,config.HOURLY_SEND_LIMIT);
  await db.execute(sql`UPDATE messages SET outbound_state='PREPARED',prepared_at=now() WHERE id=${message.id} AND outbound_state IN ('READY','DRAFT')`);
  await db.execute(sql`UPDATE messages SET outbound_state='SENDING' WHERE id=${message.id} AND outbound_state='PREPARED'`);
  const gmail=deps.gmail??new GmailClient(config);
  try{
    const result=await gmail.send({to:message.to_email,subject:message.subject,body:message.body,threadId:message.gmail_thread_id??undefined,idempotencyKey:message.idempotency_key});
    if(!result.messageId){await db.execute(sql`UPDATE messages SET outbound_state='RECONCILING',reconciliation_at=now() WHERE id=${message.id}`);return}
    await db.execute(sql`UPDATE messages SET gmail_message_id=${result.messageId},gmail_thread_id=${result.threadId??null},sent_at=now(),outbound_state='SENT' WHERE id=${message.id}`);
    await db.execute(sql`UPDATE message_sequences SET status='ACTIVE',next_step='DAY_3',next_run_at=now()+interval '3 days' WHERE id=${message.sequence_id}`);await db.execute(sql`UPDATE companies SET status='SENT',updated_at=now() WHERE id=${message.company_id}`);await audit(db,'EMAIL_SENT',{messageId:message.id,gmailMessageId:result.messageId,mode},message.company_id,job.id);if(deps.notifier)await deps.notifier.notify('EMAIL_SENT',`Correo enviado a ${message.to_email}`);return result;
  }catch(error){if(uncertain(error)){await db.execute(sql`UPDATE messages SET outbound_state='RECONCILING',reconciliation_at=now(),failure_code='UNCERTAIN_DELIVERY' WHERE id=${message.id}`);await audit(db,'EMAIL_RECONCILIATION_REQUIRED',{messageId:message.id,error:String(error)},message.company_id,job.id);return}await db.execute(sql`UPDATE messages SET outbound_state='FAILED',failure_code=${String(error)} WHERE id=${message.id}`);throw error}
}
