import 'dotenv/config';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {draftHandler} from '../src/jobs/handlers/draft-handler.js';
import {sendHandler} from '../src/jobs/handlers/send-handler.js';
import {eligibleForOutreach,loadOutreachCandidates} from '../src/outreach/batch.js';

const confirmed=process.argv.includes('--confirm-send');
const config=loadConfig();
const client=createDb(config);
try{
  await migrate(client.pool);
  const candidates=await loadOutreachCandidates(client.db);
  const eligible=candidates.filter(eligibleForOutreach);
  if(!confirmed){console.log(JSON.stringify({mode:'DRY_RUN',total:candidates.length,eligible:eligible.length,held:candidates.length-eligible.length,sendableBySegment:{COLD_CHAIN:eligible.filter(item=>item.segment==='REFRIGERATED').length,GENERAL:eligible.filter(item=>item.segment==='NON_REFRIGERATED').length},message:'No se envió ningún correo. Usar --confirm-send solo con autorización explícita.'},null,2));process.exit(0)}
  const sendConfig={...config,OUTREACH_ENABLED:true,OUTREACH_MODE:'MANUAL' as const};
  let sent=0;let alreadySent=0;let failed=0;
  for(const candidate of eligible){
    try{
      const message=await draftHandler(client.db,{...sendConfig,OUTREACH_ENABLED:false,OUTREACH_MODE:'MANUAL'},{id:`cli:email-execute:draft:${candidate.companyId}`,payload:{companyId:candidate.companyId}},{});
      if(!message)continue;
      if(message.outbound_state==='SENT'){alreadySent++;continue}
      const result=await sendHandler(client.db,sendConfig,{id:`cli:email-execute:send:${message.id}`,payload:{companyId:candidate.companyId,messageId:message.id,approvedBy:'explicit-user-trigger'}},{});
      if((result as any)?.messageId)sent++;else alreadySent++;
    }catch(error){
      if(String(error).includes('OUTREACH_LIMIT_REACHED'))break;
      failed++;console.error(JSON.stringify({companyId:candidate.companyId,email:candidate.email,error:String(error)}));
    }
  }
  console.log(JSON.stringify({mode:'EXECUTE',total:candidates.length,eligible:eligible.length,sent,alreadySent,failed,limits:{daily:sendConfig.DAILY_SEND_LIMIT,hourly:sendConfig.HOURLY_SEND_LIMIT}},null,2));
}catch(error){console.error(`EMAIL_EXECUTE_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
