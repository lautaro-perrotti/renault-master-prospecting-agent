import 'dotenv/config';
import {loadConfig} from '../src/config.js';
import {closeDb,createDb} from '../src/db/client.js';
import {migrate} from '../src/db/migrate.js';
import {draftHandler} from '../src/jobs/handlers/draft-handler.js';
import {eligibleForOutreach,loadOutreachCandidates} from '../src/outreach/batch.js';

const config=loadConfig();
const client=createDb(config);
try{
  await migrate(client.pool);
  const candidates=await loadOutreachCandidates(client.db);
  const eligible=candidates.filter(eligibleForOutreach);
  const held=candidates.length-eligible.length;
  let prepared=0;
  for(const candidate of eligible){
    const message=await draftHandler(client.db,{...config,OUTREACH_ENABLED:false,OUTREACH_MODE:'MANUAL'},{id:`cli:email-prepare:${candidate.companyId}`,payload:{companyId:candidate.companyId}},{});
    if(message)prepared++;
  }
  console.log(JSON.stringify({mode:'PREPARE_ONLY',total:candidates.length,eligible:eligible.length,held,prepared,lists:{COLD_CHAIN:eligible.filter(item=>item.segment==='REFRIGERATED').map(item=>({company:item.companyName,email:item.email})),GENERAL:eligible.filter(item=>item.segment==='NON_REFRIGERATED').map(item=>({company:item.companyName,email:item.email})),HELD:candidates.filter(item=>!eligibleForOutreach(item)).map(item=>({company:item.companyName,email:item.email,segment:item.segment,companyStatus:item.companyStatus,verificationStatus:item.verificationStatus,invalid:item.invalid,suppressed:item.suppressed}))}},null,2));
}catch(error){console.error(`EMAIL_PREPARE_FAILED: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}finally{await closeDb(client)}
