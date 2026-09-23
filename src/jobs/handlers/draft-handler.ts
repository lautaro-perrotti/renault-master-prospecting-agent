import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {composeEmail} from '../../outreach/composer.js';
import type {JobDependencies} from '../dependencies.js';
import {effectiveMode} from '../runtime-config.js';
import {enqueue} from '../queue.js';
import {getSuppressionDecision} from '../../outreach/suppression.js';

const campaignName='DEFAULT_TRANSPORT_OUTREACH';
function profile(config:Config){try{return config.SERVICE_PROFILE_JSON?JSON.parse(config.SERVICE_PROFILE_JSON):{vehicle:'Renault Master con opción refrigerada',temperatureCapability:'configurada segÃºn carga',baseLocation:config.BASE_LOCATION,coverage:config.SERVICE_COVERAGE.split(','),availability:'a coordinar',cargoTypes:['mercadería seca, alimentos refrigerados y congelados'],certifications:[],documentation:[],contactPerson:'',phone:'',videoUrl:''}}catch{throw new Error('INVALID_SERVICE_PROFILE_JSON')}}
export async function draftHandler(db:Db,config:Config,job:any,_deps:JobDependencies){
  const companyId=String(job.payload.companyId);const company=(await db.execute(sql`SELECT id,name,status FROM companies WHERE id=${companyId}`)).rows[0] as any;if(!company)throw new Error('COMPANY_NOT_FOUND');
  const suppression=await getSuppressionDecision(db,companyId);if(suppression.suppressed)return;
  const contact=(await db.execute(sql`SELECT email FROM contacts WHERE company_id=${companyId} AND email IS NOT NULL AND invalid=false ORDER BY (verification_status='DELIVERY_VALIDATED') DESC,(verification_status='MX_VALID') DESC LIMIT 1`)).rows[0] as any;
  const evidence=(await db.execute(sql`SELECT id,excerpt FROM evidence WHERE company_id=${companyId} ORDER BY observed_at DESC LIMIT 3`)).rows as any[];
  if(!contact||!evidence.length){await audit(db,'DRAFT_SKIPPED',{reason:!contact?'NO_CONTACT':'NO_EVIDENCE'},companyId,job.id);return}
  let campaign=(await db.execute(sql`SELECT id FROM campaigns WHERE name=${campaignName}`)).rows[0] as any;if(!campaign)campaign=(await db.execute(sql`INSERT INTO campaigns(name,status) VALUES(${campaignName},'ACTIVE') ON CONFLICT(name) DO UPDATE SET status=excluded.status RETURNING id`)).rows[0];
  let sequence=(await db.execute(sql`SELECT id FROM message_sequences WHERE company_id=${companyId} AND campaign_id=${campaign.id} AND status IN ('READY','ACTIVE','PAUSED') LIMIT 1`)).rows[0] as any;
  if(!sequence)sequence=(await db.execute(sql`INSERT INTO message_sequences(company_id,campaign_id,status,next_step,next_run_at) VALUES(${companyId},${campaign.id},'READY','DAY_0',now()) ON CONFLICT(company_id,campaign_id) DO UPDATE SET status=message_sequences.status RETURNING id`)).rows[0];
  const existing=(await db.execute(sql`SELECT * FROM messages WHERE sequence_id=${sequence.id} AND sequence_step='DAY_0' LIMIT 1`)).rows[0] as any;
  const message=existing??(await db.execute(sql`INSERT INTO messages(company_id,sequence_id,direction,to_email,subject,body,idempotency_key,sequence_step,outbound_state) VALUES(${companyId},${sequence.id},'OUTBOUND',${contact.email},${`Solución de transporte para ${company.name}`},${composeEmail(company.name,contact.email,evidence.map(x=>x.excerpt),profile(config),config).body},${`${sequence.id}:DAY_0`},'DAY_0','READY') ON CONFLICT(sequence_id,sequence_step) DO UPDATE SET body=messages.body RETURNING *`)).rows[0];
  await db.execute(sql`UPDATE companies SET status=CASE WHEN status IN ('BLOCKED','STOPPED') THEN status ELSE 'DRAFTED' END,updated_at=now() WHERE id=${companyId}`);await audit(db,'DRAFT_CREATED',{messageId:message.id,sequenceId:sequence.id,evidenceIds:evidence.map(x=>x.id),recipient:contact.email},companyId,job.id);
  const mode=await effectiveMode(db,config);const qualification=(await db.execute(sql`SELECT decision FROM qualifications WHERE company_id=${companyId} ORDER BY created_at DESC LIMIT 1`)).rows[0] as any;
  if(mode==='AUTO'&&config.OUTREACH_ENABLED&&qualification?.decision==='AUTO_ELIGIBLE')await enqueue(db,'SEND',{companyId,messageId:message.id},new Date(),{idempotencyKey:`SEND:${message.id}`});
  return message;
}
