import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {GmailClient} from '../../outreach/gmail.js';
import {classifyReply} from '../../replies/classifier.js';
import {sequenceAction,suppressionFor} from '../../replies/processing.js';
import {createSuppression,getSuppressionDecision} from '../../outreach/suppression.js';
import {operationallyAllowed} from '../../operations/state.js';
import type {JobDependencies} from '../dependencies.js';
import {enqueue} from '../queue.js';

export async function replyPollHandler(db:Db,config:Config,job:any,deps:JobDependencies){
  if(!await operationallyAllowed(db,'REPLY_POLL'))return;
  const gmail=deps.gmail??new GmailClient(config);
  if(gmail.findByIdempotencyKey){for(const pending of await db.execute(sql`SELECT id,company_id,idempotency_key FROM messages WHERE outbound_state='RECONCILING' AND idempotency_key IS NOT NULL`).then(result=>result.rows as any[])){const found=await gmail.findByIdempotencyKey(pending.idempotency_key);if(found?.messageId){await db.execute(sql`UPDATE messages SET gmail_message_id=${found.messageId},gmail_thread_id=${found.threadId??null},sent_at=COALESCE(sent_at,now()),outbound_state='SENT',reconciliation_at=now() WHERE id=${pending.id}`);await audit(db,'EMAIL_RECONCILED',{messageId:pending.id,gmailMessageId:found.messageId},pending.company_id,job.id)}}}
  for(const item of await gmail.listInbox()){
    if(!item.id)continue;
    const known=await db.execute(sql`SELECT 1 FROM replies WHERE gmail_message_id=${item.id}`);if(known.rows.length)continue;
    const incoming=await gmail.getMessage(item.id);
    const original=(await db.execute(sql`SELECT m.*,s.id AS sequence_id FROM messages m JOIN message_sequences s ON s.id=m.sequence_id WHERE m.gmail_thread_id=${incoming.threadId??''} AND m.direction='OUTBOUND' ORDER BY m.sent_at ASC LIMIT 1`)).rows[0] as any;if(!original)continue;
    const classified=deps.classifyReply?await deps.classifyReply(incoming.body):await classifyReply(config,incoming.body);
    const result=await db.execute(sql`INSERT INTO replies(company_id,message_id,gmail_message_id,body,classification) VALUES(${original.company_id},${original.id},${incoming.id},${incoming.body},${classified.classification}) ON CONFLICT(gmail_message_id) DO NOTHING RETURNING id`);if(!result.rows.length)continue;
    const action=sequenceAction(classified.classification);if(action==='STOPPED')await db.execute(sql`UPDATE message_sequences SET status='STOPPED',human_response=${classified.classification!=='AUTO_REPLY'},next_run_at=NULL WHERE id=${original.sequence_id}`);
    const suppression=suppressionFor(classified.classification,original.to_email);if(suppression)await createSuppression(db,suppression);if(classified.classification==='BOUNCE')await db.execute(sql`UPDATE contacts SET invalid=true WHERE company_id=${original.company_id} AND email=${original.to_email}`);
    await db.execute(sql`UPDATE companies SET status=CASE WHEN ${action}='STOPPED' THEN 'REPLIED' ELSE status END,updated_at=now() WHERE id=${original.company_id}`);await audit(db,'REPLY_PROCESSED',{gmailMessageId:incoming.id,classification:classified.classification},original.company_id,job.id);
    if(deps.notifier&&['INTERESTED','QUESTION'].includes(classified.classification))await deps.notifier.notify(classified.classification==='INTERESTED'?'REPLY_INTERESTED':'REPLY_QUESTION',`Respuesta ${classified.classification} de ${original.to_email}`);
  }
}

export async function followupHandler(db:Db,_config:Config,_job:any,_deps:JobDependencies){
  if(!await operationallyAllowed(db,'SEND'))return;
  const sequences=(await db.execute(sql`SELECT s.*,c.id AS company_id FROM message_sequences s JOIN companies c ON c.id=s.company_id WHERE s.status='ACTIVE' AND s.next_run_at<=now() AND s.next_step IN ('DAY_3','DAY_7')`)).rows as any[];
  for(const sequence of sequences){
    const stopped=await db.execute(sql`SELECT 1 FROM replies WHERE company_id=${sequence.company_id} AND classification IN ('INTERESTED','QUESTION','NOT_INTERESTED','OPT_OUT','BOUNCE') LIMIT 1`);if(stopped.rows.length)continue;
    const last=(await db.execute(sql`SELECT * FROM messages WHERE sequence_id=${sequence.id} AND outbound_state='SENT' ORDER BY sent_at DESC LIMIT 1`)).rows[0] as any;if(!last)continue;
    const suppression=await getSuppressionDecision(db,sequence.company_id,last.to_email);if(suppression.suppressed)continue;
    const step=sequence.next_step==='DAY_3'?'FOLLOW_UP_1':'FOLLOW_UP_2';const body=step==='FOLLOW_UP_1'?'Queria retomar mi mensaje anterior. Pudieron revisarlo?':'Cierro el seguimiento por ahora. Si surge una necesidad de transporte refrigerado, quedo a disposicion.';
    const inserted=await db.execute(sql`INSERT INTO messages(company_id,sequence_id,direction,to_email,subject,body,idempotency_key,sequence_step,outbound_state,gmail_thread_id) VALUES(${sequence.company_id},${sequence.id},'OUTBOUND',${last.to_email},${last.subject},${body},${`${sequence.id}:${step}`},${step},'READY',${last.gmail_thread_id}) ON CONFLICT(sequence_id,sequence_step) DO NOTHING RETURNING id`);const message=inserted.rows[0] as any;if(!message)continue;
    await db.execute(sql`UPDATE message_sequences SET next_step=${step==='FOLLOW_UP_1'?'DAY_7':'DONE'},next_run_at=${step==='FOLLOW_UP_1'?sql`now()+interval '4 days'`:sql`NULL`} WHERE id=${sequence.id}`);await enqueue(db,'SEND',{companyId:sequence.company_id,messageId:message.id,followUp:true},new Date(),{idempotencyKey:`SEND:${message.id}`});
  }
}
