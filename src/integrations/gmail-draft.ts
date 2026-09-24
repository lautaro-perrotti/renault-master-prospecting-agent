import 'dotenv/config';
import {loadConfig} from '../config.js';
import {createDb,closeDb} from '../db/client.js';
import {migrate} from '../db/migrate.js';
import {gmailDraftHandler} from '../jobs/handlers/gmail-draft-handler.js';

async function main(){
  const index=process.argv.indexOf('--message-id');
  const messageId=index>=0?process.argv[index+1]:undefined;
  if(!messageId)throw new Error('USAGE: npm run gmail:draft -- --message-id <messageId>');
  const config=loadConfig();
  const client=createDb(config);
  try{await migrate(client.pool);const result=await gmailDraftHandler(client.db,config,{id:`cli:gmail-draft:${messageId}`,payload:{messageId}});console.log(JSON.stringify({provider:'Gmail',status:'DRAFT_CREATED',logicalMessageId:messageId,...result}))}finally{await closeDb(client)}
}
main().catch(error=>{console.error(JSON.stringify({provider:'Gmail',status:'ERROR',error:String(error).slice(0,300)}));process.exitCode=1});
