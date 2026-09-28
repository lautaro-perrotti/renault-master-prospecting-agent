import 'dotenv/config';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {audit} from '../src/audit.js';
import {composeEmail} from '../src/outreach/composer.js';
import {classifyPersistedRefrigeration} from '../src/qualification/refrigeration.js';

const campaignName='DEFAULT_TRANSPORT_OUTREACH';
function profile(config:ReturnType<typeof loadConfig>){try{return config.SERVICE_PROFILE_JSON?JSON.parse(config.SERVICE_PROFILE_JSON):{vehicle:'4 Renault Master',temperatureCapability:'configurada según carga',baseLocation:config.BASE_LOCATION,coverage:config.SERVICE_COVERAGE.split(','),availability:'a coordinar',cargoTypes:['mercadería seca, alimentos refrigerados y congelados'],certifications:[],documentation:[],contactPerson:'',phone:'',videoUrl:'',showRefrigerationCapability:true}}catch{throw new Error('INVALID_SERVICE_PROFILE_JSON')}}

const config=loadConfig(),client=createDb(config);
try{
  await migrate(client.pool);
  const run=(await client.db.execute(sql`INSERT INTO runs(type,status,metadata) VALUES('EMAIL_PREPARE_ALL_VERIFIED','RUNNING','{}'::jsonb) RETURNING id`)).rows[0] as any;
  const result=await client.db.execute(sql`SELECT c.id AS company_id,c.name AS company_name,c.status AS company_status,ct.email,ct.verification_status,q.use_case,q.refrigeration_fit,r.use_case AS research_use_case,r.refrigeration_fit AS research_refrigeration_fit,e.excerpt FROM companies c JOIN LATERAL(SELECT email,verification_status,invalid FROM contacts WHERE company_id=c.id AND email IS NOT NULL AND invalid=false AND verification_status IN ('DOMAIN_VALID','MX_VALID','DELIVERY_VALIDATED') ORDER BY (verification_status='DELIVERY_VALIDATED') DESC,(verification_status='MX_VALID') DESC,email LIMIT 1) ct ON true LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) q ON true LEFT JOIN LATERAL(SELECT use_case,refrigeration_fit FROM research_results WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) r ON true LEFT JOIN LATERAL(SELECT excerpt FROM evidence WHERE company_id=c.id ORDER BY observed_at DESC LIMIT 1) e ON true WHERE c.status NOT IN ('BLOCKED','STOPPED','DISCARDED') AND NOT EXISTS(SELECT 1 FROM suppressions s WHERE s.company_id=c.id OR (s.email IS NOT NULL AND lower(s.email)=lower(ct.email)) OR (s.domain IS NOT NULL AND c.domain IS NOT NULL AND lower(s.domain)=lower(c.domain))) AND e.excerpt IS NOT NULL ORDER BY c.name`);
  const rows=result.rows as any[];let prepared=0,cold=0,general=0,failed=0;
  let campaign=(await client.db.execute(sql`SELECT id FROM campaigns WHERE name=${campaignName}`)).rows[0] as any;
  if(!campaign)campaign=(await client.db.execute(sql`INSERT INTO campaigns(name,status) VALUES(${campaignName},'ACTIVE') RETURNING id`)).rows[0];
  for(const row of rows){
    try{
      const companyId=String(row.company_id),segment=classifyPersistedRefrigeration({useCase:row.use_case,refrigerationFit:row.refrigeration_fit,fallbackUseCase:row.research_use_case,fallbackRefrigerationFit:row.research_refrigeration_fit});
      const subjectVariant=segment==='REFRIGERATED'?'COLD_CHAIN':'GENERAL';
      const composed=composeEmail(String(row.company_name),String(row.email),[String(row.excerpt)],{...profile(config),showRefrigerationCapability:true,subjectVariant},config);
      let sequence=(await client.db.execute(sql`SELECT id FROM message_sequences WHERE company_id=${companyId} AND campaign_id=${String(campaign.id)} LIMIT 1`)).rows[0] as any;
      if(!sequence)sequence=(await client.db.execute(sql`INSERT INTO message_sequences(company_id,campaign_id,status,next_step,next_run_at) VALUES(${companyId},${String(campaign.id)},'READY','DAY_0',now()) RETURNING id`)).rows[0];
      const message=(await client.db.execute(sql`INSERT INTO messages(company_id,sequence_id,direction,to_email,subject,body,html_body,idempotency_key,sequence_step,outbound_state,prepared_at) VALUES(${companyId},${String(sequence.id)},'OUTBOUND',${composed.to},${composed.subject},${composed.body},${composed.htmlBody},${`${sequence.id}:DAY_0`},'DAY_0','READY',now()) ON CONFLICT(sequence_id,sequence_step) DO UPDATE SET to_email=excluded.to_email,subject=excluded.subject,body=excluded.body,html_body=excluded.html_body,prepared_at=now(),outbound_state=CASE WHEN messages.outbound_state IN ('SENT','SENDING','RECONCILING') THEN messages.outbound_state ELSE 'READY' END RETURNING id`)).rows[0] as any;
      await client.db.execute(sql`UPDATE companies SET status=CASE WHEN status IN ('BLOCKED','STOPPED') THEN status ELSE 'DRAFTED' END,updated_at=now() WHERE id=${companyId}`);
      await audit(client.db,'DRAFT_CREATED',{messageId:String(message.id),sequenceId:String(sequence.id),recipient:composed.to,refrigerationSegment:segment==='UNKNOWN'?'GENERAL_FALLBACK':segment,classificationSource:segment==='UNKNOWN'?'ALL_VERIFIED_GENERAL_FALLBACK':'qualification_or_research'},companyId,undefined,String(run.id));
      prepared++;if(segment==='REFRIGERATED')cold++;else general++;
    }catch(error){failed++;await audit(client.db,'DRAFT_SKIPPED',{reason:'PREPARE_ALL_FAILED',error:String(error).slice(0,500),recipient:row.email},String(row.company_id),undefined,String(run.id))}
  }
  const summary={companiesSelected:rows.length,prepared,coldChain:cold,general,generalFallback:rows.filter(row=>classifyPersistedRefrigeration({useCase:row.use_case,refrigerationFit:row.refrigeration_fit,fallbackUseCase:row.research_use_case,fallbackRefrigerationFit:row.research_refrigeration_fit})==='UNKNOWN').length,failed,note:'No se enviaron correos.'};
  await client.db.execute(sql`UPDATE runs SET status='DONE',finished_at=now(),metadata=${JSON.stringify(summary)}::jsonb WHERE id=${String(run.id)}`);
  console.log(JSON.stringify({mode:'PREPARE_ALL_VERIFIED',...summary},null,2));
}catch(error){console.error(`EMAIL_PREPARE_ALL_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
