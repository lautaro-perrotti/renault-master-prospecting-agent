import 'dotenv/config';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {sendHandler} from '../src/jobs/handlers/send-handler.js';
import {sql} from 'drizzle-orm';

const confirmed=process.argv.includes('--confirm-send');
const sleep=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const config=loadConfig();
const client=createDb(config);
try{
  await migrate(client.pool);
  const result=await client.db.execute(sql`SELECT m.id,m.company_id,m.to_email,m.subject,m.outbound_state FROM messages m JOIN message_sequences ms ON ms.id=m.sequence_id JOIN campaigns ca ON ca.id=ms.campaign_id JOIN companies c ON c.id=m.company_id WHERE ca.name='DEFAULT_TRANSPORT_OUTREACH' AND m.direction='OUTBOUND' AND m.sequence_step='DAY_0' AND m.prepared_at IS NOT NULL AND m.outbound_state IN ('READY','DRAFT','FAILED') AND c.status NOT IN ('BLOCKED','STOPPED','DISCARDED') ORDER BY m.prepared_at,m.id`);
  const messages=result.rows as any[];
  const cold=messages.filter(message=>String(message.subject).startsWith('Contacto comercial | Transporte refrigerado y congelado')).length;
  const general=messages.length-cold;
  if(!confirmed){console.log(JSON.stringify({mode:'DRY_RUN',prepared:messages.length,sendableBySegment:{COLD_CHAIN:cold,GENERAL:general},message:'No se envió ningún correo. Usar --confirm-send solo con autorización explícita.'},null,2));process.exit(0)}
  const sendConfig={...config,OUTREACH_ENABLED:true,OUTREACH_MODE:'MANUAL' as const};
  let sent=0;let alreadySent=0;let failed=0;let lastAttemptAt=0;
  for(const message of messages){
    try{
      if(message.outbound_state==='SENT'){alreadySent++;continue}
      const waitMs=Math.max(0,sendConfig.SEND_INTERVAL_MS-(Date.now()-lastAttemptAt));
      if(waitMs>0)await sleep(waitMs);
      lastAttemptAt=Date.now();
      const result=await sendHandler(client.db,sendConfig,{id:`cli:email-execute:send:${message.id}`,payload:{companyId:message.company_id,messageId:message.id,approvedBy:'explicit-user-trigger'}},{});
      if((result as any)?.messageId)sent++;else alreadySent++;
    }catch(error){
      if(String(error).includes('OUTREACH_LIMIT_REACHED'))break;
      failed++;console.error(JSON.stringify({companyId:message.company_id,email:message.to_email,error:String(error)}));
    }
  }
  console.log(JSON.stringify({mode:'EXECUTE',prepared:messages.length,sent,alreadySent,failed,limits:{daily:sendConfig.DAILY_SEND_LIMIT,hourly:sendConfig.HOURLY_SEND_LIMIT,intervalMs:sendConfig.SEND_INTERVAL_MS,perMinute:sendConfig.SEND_INTERVAL_MS?Math.floor(60000/sendConfig.SEND_INTERVAL_MS):null}},null,2));
}catch(error){console.error(`EMAIL_EXECUTE_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
