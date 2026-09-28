import 'dotenv/config';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {audit} from '../src/audit.js';
import {verifyEmailDomain,type EmailDnsResult} from '../src/outreach/email-verification.js';

const config=loadConfig(),client=createDb(config),concurrency=5;
async function mapWithConcurrency<T,R>(items:T[],worker:(item:T)=>Promise<R>,limit:number){const results:R[]=[];let next=0;async function run(){while(true){const index=next++;if(index>=items.length)return;results[index]=await worker(items[index])}}await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>run()));return results}

try{
  await migrate(client.pool);
  const run=(await client.db.execute(sql`INSERT INTO runs(type,status,metadata) VALUES('EMAIL_DOMAIN_VERIFICATION','RUNNING',${JSON.stringify({concurrency})}::jsonb) RETURNING id`)).rows[0] as any;
  const rows=(await client.db.execute(sql`SELECT id,company_id,email FROM contacts WHERE email IS NOT NULL AND btrim(email)<>'' AND invalid=false ORDER BY lower(email),id`)).rows as any[];
  const unique=[...new Map(rows.map(row=>[String(row.email).trim().toLowerCase(),String(row.email).trim().toLowerCase()])).values()];
  const checked=await mapWithConcurrency(unique,verifyEmailDomain,concurrency),byEmail=new Map(checked.map(result=>[result.email,result])),counts:Record<string,number>={MX_VALID:0,DOMAIN_VALID:0,DNS_UNVERIFIED:0};
  for(const result of checked)counts[result.status]=(counts[result.status]??0)+1;
  for(const row of rows){const email=String(row.email).trim().toLowerCase(),result=byEmail.get(email) as EmailDnsResult,nextStatus=result.status==='MX_VALID'?'MX_VALID':result.status==='DOMAIN_VALID'?'DOMAIN_VALID':'SYNTAX_VALID';await client.db.execute(sql`UPDATE contacts SET verification_status=${nextStatus},verified=${result.status!=='DNS_UNVERIFIED'} WHERE id=${String(row.id)}`);await audit(client.db,'EMAIL_DOMAIN_VERIFIED',{email,domain:result.domain,status:result.status,mxHosts:result.mxHosts,errorCode:result.errorCode??null},String(row.company_id),undefined,String(run.id))}
  await client.db.execute(sql`UPDATE runs SET status='DONE',finished_at=now(),metadata=${JSON.stringify({concurrency,contactRows:rows.length,uniqueEmails:unique.length,counts})}::jsonb WHERE id=${String(run.id)}`);
  console.log(JSON.stringify({runId:String(run.id),contactRows:rows.length,uniqueEmails:unique.length,counts,note:'No se enviaron correos.'},null,2));
}catch(error){console.error(`EMAIL_DOMAIN_VERIFICATION_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
