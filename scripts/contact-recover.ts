import 'dotenv/config';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {audit} from '../src/audit.js';
import {enqueue} from '../src/jobs/queue.js';

const excludedDomains=new Set(['bumeran.com.ar','gba.gob.ar','ar.kompass.com','new.abb.com','logistica-distribucion.com.ar']);
const enqueueMode=process.argv.includes('--enqueue');
const reprocessMode=process.argv.includes('--reprocess');
const config=loadConfig();
const client=createDb(config);
try{
  await migrate(client.pool);
  if(reprocessMode){
    const recovered=await client.db.execute(sql`SELECT j.payload->>'companyId' AS company_id,c.name,count(e.id)::int AS evidence_count FROM jobs j JOIN companies c ON j.payload->>'companyId'=c.id::text LEFT JOIN evidence e ON e.company_id=c.id WHERE j.idempotency_key LIKE 'CONTACT_RECOVERY:%' AND j.status='DONE' GROUP BY j.payload->>'companyId',c.name HAVING count(e.id)>0 ORDER BY c.name`);
    const queued=[];const held=[];
    for(const row of recovered.rows as any[]){const companyId=String(row.company_id);const existing=(await client.db.execute(sql`SELECT id,status FROM jobs WHERE idempotency_key=${`CONTACT_RECOVERY_RESEARCH:${companyId}`} LIMIT 1`)).rows[0] as any;if(existing&&['PENDING','RUNNING','DONE'].includes(String(existing.status))){held.push({companyId,companyName:String(row.name),reason:'RESEARCH_ALREADY_PROCESSED',jobId:String(existing.id),jobStatus:String(existing.status)});continue}const job=await enqueue(client.db,'RESEARCH',{companyId,recovery:'CONTACT_RECOVERY'},new Date(),{idempotencyKey:`CONTACT_RECOVERY_RESEARCH:${companyId}`,priority:1});if(job){await audit(client.db,'CONTACT_RECOVERY_RESEARCH_ENQUEUED',{evidenceCount:Number(row.evidence_count)},companyId,String(job.id));queued.push({companyId,companyName:String(row.name),evidenceCount:Number(row.evidence_count),jobId:String(job.id)})}}
    console.log(JSON.stringify({mode:'REPROCESS',eligible:recovered.rows.length,queued:queued.length,held:held.length,queuedCompanies:queued,heldCompanies:held,message:'Se reencolaron investigaciones. No se envio ningun correo.',outreachEnabled:config.OUTREACH_ENABLED,outreachMode:config.OUTREACH_MODE},null,2));
    await closeDb(client);process.exit(0);
  }
  const result=await client.db.execute(sql`SELECT c.id,c.name,c.status,c.website,c.domain FROM companies c WHERE c.status NOT IN ('BLOCKED','STOPPED','DISCARDED') AND (c.phone IS NULL OR btrim(c.phone)='') AND NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct.company_id=c.id AND ((ct.email IS NOT NULL AND btrim(ct.email)<>'') OR (ct.phone IS NOT NULL AND btrim(ct.phone)<>''))) AND c.website IS NOT NULL AND btrim(c.website)<>'' ORDER BY c.name`);
  const rows=(result.rows as any[]).map(row=>{let hostname='';try{hostname=new URL(String(row.website)).hostname.toLowerCase().replace(/^www\./,'')}catch{}return{companyId:String(row.id),companyName:String(row.name),status:String(row.status),website:String(row.website),domain:row.domain?String(row.domain):null,hostname}});
  const selected=rows.filter(row=>!excludedDomains.has(row.hostname));
  const skipped=rows.filter(row=>excludedDomains.has(row.hostname)).map(row=>({...row,reason:'NON_CORPORATE_OR_SHARED_SOURCE'}));
  const queued=[];const held=[];
  for(const row of selected){
    const pending=(await client.db.execute(sql`SELECT id,status FROM jobs WHERE type='CRAWL' AND status IN ('PENDING','RUNNING','RETRY') AND (idempotency_key=${`CONTACT_RECOVERY:${row.companyId}`} OR payload->>'companyId'=${row.companyId}) LIMIT 1`)).rows[0] as any;
    if(pending){held.push({...row,reason:'CRAWL_ALREADY_PENDING',jobId:String(pending.id),jobStatus:String(pending.status)});continue}
    if(enqueueMode){const job=await enqueue(client.db,'CRAWL',{companyId:row.companyId,website:row.website,recovery:'CONTACT_RECOVERY'},new Date(),{idempotencyKey:`CONTACT_RECOVERY:${row.companyId}`,priority:1});if(job){await audit(client.db,'CONTACT_RECOVERY_CRAWL_ENQUEUED',{website:row.website,source:'company.website'},row.companyId,String(job.id));queued.push({...row,jobId:String(job.id)})}}
    else queued.push(row);
  }
  console.log(JSON.stringify({mode:enqueueMode?'ENQUEUED':'DRY_RUN',selected:rows.length,eligible:selected.length,excluded:skipped.length,queued:queued.length,held:held.length,excludedCompanies:skipped,queuedCompanies:queued,heldCompanies:held,message:enqueueMode?'Se encolaron rastreos. No se envio ningun correo.':'No se modifico la cola. Usar --enqueue para encolar rastreos.',outreachEnabled:config.OUTREACH_ENABLED,outreachMode:config.OUTREACH_MODE},null,2));
}catch(error){console.error(`CONTACT_RECOVERY_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
