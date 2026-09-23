import 'dotenv/config';
import {Bot} from 'grammy';
import {loadConfig} from '../config.js';

const config=loadConfig();
if(!config.TELEGRAM_BOT_TOKEN)throw new Error('NOT_CONFIGURED: TELEGRAM_BOT_TOKEN');
export const telegramBot=new Bot(config.TELEGRAM_BOT_TOKEN);
export {config};

export async function main(){
  const me=await telegramBot.api.getMe();
  const webhook=await telegramBot.api.getWebhookInfo();
  console.log(JSON.stringify({telegramApi:'PASS',bot:{id:me.id,username:me.username,first_name:me.first_name},webhook:{url:webhook.url,has_custom_certificate:webhook.has_custom_certificate,pending_update_count:webhook.pending_update_count,last_error_date:webhook.last_error_date??null,last_error_message:webhook.last_error_message??null}},null,2));
}

if(import.meta.url===`file://${process.argv[1]?.replaceAll('\\','/')}`)void main().catch(error=>{console.error(error);process.exitCode=1});
