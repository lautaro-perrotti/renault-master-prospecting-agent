import 'dotenv/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {classifyPersistedRefrigeration,type RefrigerationSegment} from '../src/qualification/refrigeration.js';

type ContactBucket='EMAIL_AND_PHONE'|'EMAIL_ONLY'|'PHONE_ONLY'|'NO_CONTACT';
type Recommendation='READY_COLD_CHAIN'|'READY_GENERAL'|'HOLD_REFRIGERATION_CLASSIFICATION'|'HOLD_EMAIL_VERIFICATION'|'PHONE_FOLLOW_UP'|'RECOVER_CONTACT_FROM_SOURCE'|'NO_CONTACT_NO_SOURCE'|'DO_NOT_SEND_SUPPRESSED'|'DO_NOT_SEND_COMPANY_STATUS';

type InventoryRow={
  companyId:string; companyName:string; companyStatus:string; domain:string|null; website:string|null;
  contactBucket:ContactBucket; emailCount:number; phoneCount:number; verifiedEmailCount:number; invalidEmailCount:number;
  companyPhone:string|null; emails:string; phones:string; verificationStatuses:string; segment:RefrigerationSegment; suppressed:boolean;
  sourceCount:number; evidenceCount:number; pendingJobCount:number; preparedMessageCount:number; sentMessageCount:number;
  useCase:string|null; refrigerationFit:string|null; researchUseCase:string|null; researchRefrigerationFit:string|null;
  recommendation:Recommendation;
};

function csv(value:unknown){const text=String(value??'');return '"'+text.replace(/"/g,'""')+'"'}

function contactBucket(emailCount:number,phoneCount:number):ContactBucket{
  if(emailCount>0&&phoneCount>0)return'EMAIL_AND_PHONE';
  if(emailCount>0)return'EMAIL_ONLY';
  if(phoneCount>0)return'PHONE_ONLY';
  return'NO_CONTACT';
}

function recommendation(row:Pick<InventoryRow,'companyStatus'|'suppressed'|'verifiedEmailCount'|'segment'|'emailCount'|'phoneCount'|'sourceCount'|'evidenceCount'>):Recommendation{
  if(['BLOCKED','STOPPED','DISCARDED'].includes(row.companyStatus))return'DO_NOT_SEND_COMPANY_STATUS';
  if(row.suppressed)return'DO_NOT_SEND_SUPPRESSED';
  if(row.verifiedEmailCount>0&&row.segment==='REFRIGERATED')return'READY_COLD_CHAIN';
  if(row.verifiedEmailCount>0&&row.segment==='NON_REFRIGERATED')return'READY_GENERAL';
  if(row.emailCount>0&&row.segment==='UNKNOWN')return'HOLD_REFRIGERATION_CLASSIFICATION';
  if(row.emailCount>0)return'HOLD_EMAIL_VERIFICATION';
  if(row.phoneCount>0)return'PHONE_FOLLOW_UP';
  if(row.sourceCount>0||row.evidenceCount>0)return'RECOVER_CONTACT_FROM_SOURCE';
  return'NO_CONTACT_NO_SOURCE';
}

const config=loadConfig();
const client=createDb(config);
try{
  await migrate(client.pool);
  const result=await client.db.execute(sql`SELECT c.id AS company_id,c.name AS company_name,c.status AS company_status,c.domain,c.website,c.phone AS company_phone,
    COALESCE(ct.email_count,0)::int AS email_count,COALESCE(ph.phone_count,0)::int AS phone_count,
    COALESCE(ct.verified_email_count,0)::int AS verified_email_count,COALESCE(ct.invalid_email_count,0)::int AS invalid_email_count,
    COALESCE(ct.emails,'') AS emails,COALESCE(ph.phones,'') AS phones,COALESCE(ct.verification_statuses,'') AS verification_statuses,
    COALESCE(src.source_count,0)::int AS source_count,COALESCE(ev.evidence_count,0)::int AS evidence_count,
    COALESCE(jb.pending_job_count,0)::int AS pending_job_count,
    COALESCE(msg.prepared_message_count,0)::int AS prepared_message_count,COALESCE(msg.sent_message_count,0)::int AS sent_message_count,
    q.use_case,q.refrigeration_fit,r.use_case AS research_use_case,r.refrigeration_fit AS research_refrigeration_fit,
    EXISTS(SELECT 1 FROM suppressions s WHERE s.company_id=c.id OR (s.domain IS NOT NULL AND c.domain IS NOT NULL AND lower(s.domain)=lower(c.domain)) OR EXISTS(SELECT 1 FROM contacts sc WHERE sc.company_id=c.id AND sc.email IS NOT NULL AND s.email IS NOT NULL AND lower(s.email)=lower(sc.email))) AS suppressed
    FROM companies c
    LEFT JOIN LATERAL(SELECT count(*) FILTER (WHERE email IS NOT NULL AND btrim(email)<>'') AS email_count,count(*) FILTER (WHERE email IS NOT NULL AND btrim(email)<>'' AND invalid=false AND verification_status IN ('SYNTAX_VALID','DOMAIN_VALID','MX_VALID','DELIVERY_VALIDATED')) AS verified_email_count,count(*) FILTER (WHERE email IS NOT NULL AND btrim(email)<>'' AND invalid=true) AS invalid_email_count,string_agg(DISTINCT email,'; ' ORDER BY email) FILTER (WHERE email IS NOT NULL AND btrim(email)<>'') AS emails,string_agg(DISTINCT verification_status,'; ' ORDER BY verification_status) FILTER (WHERE email IS NOT NULL AND btrim(email)<>'') AS verification_statuses FROM contacts WHERE company_id=c.id) ct ON true
    LEFT JOIN LATERAL(SELECT count(DISTINCT phone)::int AS phone_count,string_agg(DISTINCT phone,'; ' ORDER BY phone) AS phones FROM (SELECT phone FROM contacts WHERE company_id=c.id AND phone IS NOT NULL AND btrim(phone)<>'' UNION SELECT c.phone WHERE c.phone IS NOT NULL AND btrim(c.phone)<>'') phone_values) ph ON true
    LEFT JOIN LATERAL(SELECT count(*) AS source_count FROM sources WHERE company_id=c.id) src ON true
    LEFT JOIN LATERAL(SELECT count(*) AS evidence_count FROM evidence WHERE company_id=c.id) ev ON true
    LEFT JOIN LATERAL(SELECT count(*) FILTER (WHERE status IN ('PENDING','RUNNING','RETRY')) AS pending_job_count FROM jobs WHERE payload->>'companyId'=c.id::text OR payload->>'company_id'=c.id::text) jb ON true
    LEFT JOIN LATERAL(SELECT count(*) FILTER (WHERE prepared_at IS NOT NULL AND direction='OUTBOUND' AND sequence_step='DAY_0') AS prepared_message_count,count(*) FILTER (WHERE sent_at IS NOT NULL AND direction='OUTBOUND' AND sequence_step='DAY_0') AS sent_message_count FROM messages WHERE company_id=c.id) msg ON true
    LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) q ON true
    LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM research_results WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) r ON true
    ORDER BY c.status,c.name`);

  const rows=(result.rows as any[]).map(row=>{
    const emailCount=Number(row.email_count??0),phoneCount=Number(row.phone_count??0);
    const segment=classifyPersistedRefrigeration({useCase:row.use_case,refrigerationFit:row.refrigeration_fit,fallbackUseCase:row.research_use_case,fallbackRefrigerationFit:row.research_refrigeration_fit});
    const base={companyId:String(row.company_id),companyName:String(row.company_name),companyStatus:String(row.company_status),domain:row.domain??null,website:row.website??null,contactBucket:contactBucket(emailCount,phoneCount),emailCount,phoneCount,verifiedEmailCount:Number(row.verified_email_count??0),invalidEmailCount:Number(row.invalid_email_count??0),companyPhone:row.company_phone??null,emails:String(row.emails??''),phones:String(row.phones??''),verificationStatuses:String(row.verification_statuses??''),segment,suppressed:Boolean(row.suppressed),sourceCount:Number(row.source_count??0),evidenceCount:Number(row.evidence_count??0),pendingJobCount:Number(row.pending_job_count??0),preparedMessageCount:Number(row.prepared_message_count??0),sentMessageCount:Number(row.sent_message_count??0),useCase:row.use_case??null,refrigerationFit:row.refrigeration_fit??null,researchUseCase:row.research_use_case??null,researchRefrigerationFit:row.research_refrigeration_fit??null};
    return {...base,recommendation:recommendation(base)} as InventoryRow;
  });
  const countBy=(key:keyof InventoryRow)=>rows.reduce<Record<string,number>>((acc,row)=>{const value=String(row[key]);acc[value]=(acc[value]??0)+1;return acc},{});
  const summary={generatedAt:new Date().toISOString(),grain:'one row per company',totalCompanies:rows.length,byContactBucket:countBy('contactBucket'),byRecommendation:countBy('recommendation'),byCompanyStatus:countBy('companyStatus'),bySegment:countBy('segment'),rows};
  const timestamp=new Date().toISOString().replace(/[:.]/g,'-');const directory=path.resolve('reports');await fs.mkdir(directory,{recursive:true});
  const jsonPath=path.join(directory,`contact-inventory-${timestamp}.json`);const csvPath=path.join(directory,`contact-inventory-${timestamp}.csv`);
  const headers=(Object.keys(rows[0]??{}) as Array<keyof InventoryRow>);await fs.writeFile(jsonPath,JSON.stringify(summary,null,2),'utf8');await fs.writeFile(csvPath,[headers.join(','),...rows.map(row=>headers.map(header=>csv(row[header])).join(','))].join('\n'),'utf8');
  console.log(JSON.stringify({generatedAt:summary.generatedAt,totalCompanies:summary.totalCompanies,byContactBucket:summary.byContactBucket,byRecommendation:summary.byRecommendation,byCompanyStatus:summary.byCompanyStatus,bySegment:summary.bySegment,json:jsonPath,csv:csvPath},null,2));
}catch(error){console.error(`CONTACT_INVENTORY_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
