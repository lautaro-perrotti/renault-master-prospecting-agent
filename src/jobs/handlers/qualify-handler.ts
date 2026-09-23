import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {classifyScore} from '../../domain.js';
import {scoreCompany} from '../../qualification/scorer.js';
import type {JobDependencies} from '../dependencies.js';
import {effectiveMode} from '../runtime-config.js';
import {enqueue} from '../queue.js';
import {getSuppressionDecision} from '../../outreach/suppression.js';

export async function qualifyHandler(db:Db,config:Config,job:any,deps:JobDependencies){
  const companyId=String(job.payload.companyId);const company=(await db.execute(sql`SELECT id,name,address,status,domain FROM companies WHERE id=${companyId}`)).rows[0] as any;if(!company)throw new Error('COMPANY_NOT_FOUND');
  const source=(await db.execute(sql`SELECT id FROM sources WHERE company_id=${companyId} LIMIT 1`)).rows[0];const evidence=(await db.execute(sql`SELECT id,excerpt,signal_type,confidence,observed_at FROM evidence WHERE company_id=${companyId}`)).rows as any[];
  if(!source||!evidence.length){await db.execute(sql`UPDATE companies SET status='DISCARDED',updated_at=now() WHERE id=${companyId} AND status NOT IN ('BLOCKED','STOPPED')`);await audit(db,'QUALIFICATION_REJECTED',{reason:'NO_SOURCE_OR_EVIDENCE'},companyId,job.id);return}
  const suppression=await getSuppressionDecision(db,companyId);if(suppression.suppressed){await audit(db,'QUALIFICATION_REJECTED',{reason:'SUPPRESSED',suppression:suppression.reasons},companyId,job.id);return}
  const contact=(await db.execute(sql`SELECT id FROM contacts WHERE company_id=${companyId} AND email IS NOT NULL AND invalid=false AND verification_status IN ('SYNTAX_VALID','DOMAIN_VALID','MX_VALID','DELIVERY_VALIDATED') LIMIT 1`)).rows.length>0;
  const score=scoreCompany({evidence:evidence.map(item=>({id:String(item.id),excerpt:String(item.excerpt),signalType:String(item.signal_type),observedAt:item.observed_at,confidence:Number(item.confidence)})),address:company.address,contact});
  const decision=classifyScore(score,{AUTO_SEND_THRESHOLD:config.AUTO_SEND_THRESHOLD,REVIEW_THRESHOLD:config.REVIEW_THRESHOLD});
  await db.execute(sql`INSERT INTO qualifications(company_id,fit,need,geography,contact_quality,recency,total,confidence,decision,reasoning) VALUES(${companyId},${score.fit},${score.need},${score.geography},${score.contactQuality},${score.recency},${score.total},${score.confidence},${decision},${JSON.stringify(score.reasoning)}::jsonb)`);
  const mode=await effectiveMode(db,config);const next=decision==='DISCARD'?'DISCARDED':mode==='AUTO'&&decision==='AUTO_ELIGIBLE'?'QUALIFIED':'REVIEW';await db.execute(sql`UPDATE companies SET status=CASE WHEN status IN ('BLOCKED','STOPPED') THEN status ELSE ${next} END,updated_at=now() WHERE id=${companyId}`);
  await audit(db,'QUALIFIED',{decision,total:score.total,breakdown:score,mode},companyId,job.id);
  if(decision!=='DISCARD')await enqueue(db,'DRAFT',{companyId},new Date(),{idempotencyKey:`DRAFT:${companyId}:DEFAULT_REFRIGERATED_OUTREACH`});
  if(score.total>=config.REVIEW_THRESHOLD&&deps.notifier)await deps.notifier.notify(decision==='AUTO_ELIGIBLE'?'HIGH_SCORE_LEAD':'REVIEW_REQUIRED',`${company.name}: score ${score.total} (${decision})`);
}
