import 'dotenv/config';
import {telegramBot} from './diagnostics.js';

telegramBot.api.deleteWebhook({drop_pending_updates:false}).then(async()=>{
  const webhook=await telegramBot.api.getWebhookInfo();
  console.log(JSON.stringify({webhookDeleted:true,url:webhook.url,pending_update_count:webhook.pending_update_count},null,2));
}).catch(error=>{console.error(error);process.exitCode=1});
