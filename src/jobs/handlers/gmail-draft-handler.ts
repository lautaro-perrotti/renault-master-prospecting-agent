import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {GmailClient} from '../../outreach/gmail.js';
import type {JobDependencies} from '../dependencies.js';
import {getSuppressionDecision} from '../../outreach/suppression.js';

export async function gmailDraftHandler(db:Db,config:Config,job:any,deps:JobDependencies={}){
  const messageId=String(job.payload?.messageId??'');
  if(!messageId)throw new Error('GMAIL_DRAFT_REQUIRES_MESSAGE_ID');
  const message=(await db.execute(sql`SELECT m.*,c.name AS company_name,c.status AS company_status,c.domain FROM messages m JOIN companies c ON c.id=m.company_id WHERE m.id=${messageId}`)).rows[0] as any;
  if(!message)throw new Error('MESSAGE_NOT_FOUND');
  if(message.direction!=='OUTBOUND')throw new Error('GMAIL_DRAFT_REQUIRES_OUTBOUND_MESSAGE');
  if(!message.to_email||!message.subject||!message.body||!message.idempotency_key)throw new Error('GMAIL_DRAFT_MESSAGE_INCOMPLETE');
  const suppression=await getSuppressionDecision(db,message.company_id,message.to_email,message.domain);
  if(suppression.suppressed)throw new Error(`SUPPRESSED:${suppression.reasons.join(',')}`);
  if(message.gmail_draft_id){
    await audit(db,'GMAIL_DRAFT_ALREADY_EXISTS',{messageId:message.id,gmailDraftId:message.gmail_draft_id},message.company_id,job.id);
    return{draftId:message.gmail_draft_id,messageId:message.gmail_draft_message_id??undefined,threadId:message.gmail_thread_id??undefined};
  }
  const gmail=deps.gmail??new GmailClient(config);
  if(!gmail.createDraft)throw new Error('GMAIL_DRAFT_UNSUPPORTED');
  try{
    if(gmail.findDraftByIdempotencyKey){
      const existing=await gmail.findDraftByIdempotencyKey(message.idempotency_key);
      if(existing?.draftId){
        await db.execute(sql`UPDATE messages SET gmail_draft_id=${existing.draftId},gmail_draft_message_id=${existing.messageId??null},gmail_thread_id=COALESCE(${existing.threadId??null},gmail_thread_id),failure_code=NULL WHERE id=${message.id} AND gmail_draft_id IS NULL`);
        await audit(db,'GMAIL_DRAFT_RECONCILED',{messageId:message.id,gmailDraftId:existing.draftId,gmailMessageId:existing.messageId??null},message.company_id,job.id);
        return existing;
      }
    }
    const result=await gmail.createDraft({to:message.to_email,subject:message.subject,body:message.body,threadId:message.gmail_thread_id??undefined,idempotencyKey:message.idempotency_key});
    if(!result.draftId)throw new Error('GMAIL_DRAFT_ID_MISSING');
    await db.execute(sql`UPDATE messages SET gmail_draft_id=${result.draftId},gmail_draft_message_id=${result.messageId??null},gmail_thread_id=COALESCE(${result.threadId??null},gmail_thread_id),failure_code=NULL WHERE id=${message.id} AND gmail_draft_id IS NULL`);
    await audit(db,'GMAIL_DRAFT_CREATED',{messageId:message.id,gmailDraftId:result.draftId,gmailMessageId:result.messageId??null},message.company_id,job.id);
    return result;
  }catch(error){
    await audit(db,'GMAIL_DRAFT_FAILED',{messageId:message.id,error:String(error)},message.company_id,job.id);
    throw error;
  }
}
