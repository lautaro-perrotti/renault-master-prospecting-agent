import 'dotenv/config';
import {loadConfig} from '../config.js';
import {GmailClient} from '../outreach/gmail.js';

async function main(){
  const config=loadConfig();
  if(!config.GOOGLE_CLIENT_ID||!config.GOOGLE_CLIENT_SECRET||!config.GOOGLE_REFRESH_TOKEN){
    console.log(JSON.stringify({provider:'Gmail',status:'NOT_CONFIGURED'}));
    return;
  }
  const profile=await new GmailClient(config).getProfile() as {emailAddress?:string;messagesTotal?:number;threadsTotal?:number};
  if(!profile.emailAddress)throw new Error('GMAIL_PROFILE_MISSING_EMAIL');
  console.log(JSON.stringify({provider:'Gmail',status:'REAL_API_VALIDATED',emailAddress:profile.emailAddress,messagesTotal:profile.messagesTotal,threadsTotal:profile.threadsTotal}));
}
main().catch(error=>{console.error(JSON.stringify({provider:'Gmail',status:'ERROR',error:String(error).slice(0,300)}));process.exitCode=1});
