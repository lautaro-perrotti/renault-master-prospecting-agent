import 'dotenv/config';
import Fastify from 'fastify';
import {sql} from 'drizzle-orm';
import {loadConfig} from '../config.js';
import {createDb,closeDb} from '../db/client.js';
import {migrate} from '../db/migrate.js';
import {doctor,smoke} from '../integrations/health.js';
import {createTelegramBot,parseAllowedTelegramUserIds} from '../telegram/bot.js';
import {TelegramNotifier} from '../telegram/notifier.js';
import {workerLoop} from '../jobs/worker.js';
import {createJobHandler} from '../jobs/handlers.js';
import {schedulerLoop} from '../scheduler.js';

const config=loadConfig();
const client=createDb(config);
const app=Fastify({logger:true});
app.get('/health/live',async()=>({ok:true}));
const readiness=async(_request:any,reply:any)=>{try{await client.pool.query('SELECT 1');const state=(await client.db.execute(sql`SELECT state FROM operational_state WHERE id=true`)).rows[0] as any;const heartbeats=(await client.db.execute(sql`SELECT key,value FROM configuration WHERE key IN ('WORKER_HEARTBEAT','SCHEDULER_HEARTBEAT','TELEGRAM_POLLING_HEARTBEAT','TELEGRAM_POLLING_ACTIVE')`)).rows as any[];const value=(key:string)=>heartbeats.find(row=>row.key===key)?.value??null;const workerHeartbeat=value('WORKER_HEARTBEAT');const schedulerHeartbeat=value('SCHEDULER_HEARTBEAT');const telegramHeartbeat=value('TELEGRAM_POLLING_HEARTBEAT');const telegramActive=value('TELEGRAM_POLLING_ACTIVE');const recent=(item:string|null)=>Boolean(item&&Date.now()-Date.parse(item)<120000);const telegramReady=!config.TELEGRAM_BOT_TOKEN||(telegramActive==='true'&&recent(telegramHeartbeat));if(!recent(workerHeartbeat)||!recent(schedulerHeartbeat)||!telegramReady)return reply.code(503).send({ok:false,state:state?.state??'RUNNING',workerHeartbeat,schedulerHeartbeat,telegramPollingActive:telegramActive,telegramPollingHeartbeat:telegramHeartbeat,reason:'DEPENDENCY_HEARTBEAT_MISSING_OR_STALE'});return{ok:true,state:state?.state??'RUNNING',workerHeartbeat,schedulerHeartbeat,telegramPollingActive:telegramActive,telegramPollingHeartbeat:telegramHeartbeat,mode:config.OUTREACH_MODE}}catch(error){return reply.code(503).send({ok:false,error:String(error)})}};
app.get('/health/ready',readiness);app.get('/health',readiness);
function printHealth(report:Awaited<ReturnType<typeof doctor>>){for(const [name,status] of Object.entries(report.checks))console.log(`${name.padEnd(20)} ${status}`);console.log(`Configured checks passed: ${report.configuredIntegrations}/${Object.keys(report.checks).length}`);console.log(`Actual external integrations validated: ${report.externalIntegrationsValidated}`)}
async function main(){
  const command=process.argv[2]??'serve';
  if(command==='migrate'){await migrate(client.pool);console.log('Database migrated');await closeDb(client);return}
  if(command==='doctor'){printHealth(await doctor(config,client.pool));await closeDb(client);return}
  if(command==='smoke'){printHealth(await smoke(config,client.pool));await closeDb(client);return}
  await migrate(client.pool);
  const deps={notifier:new TelegramNotifier(config)};
  if(command==='worker'){await workerLoop(client.db,createJobHandler(client.db,config,deps));return}
  if(command==='scheduler'){await schedulerLoop(client.db,config);return}
  try{await app.listen({port:config.PORT,host:'0.0.0.0'})}catch(error){if((error as NodeJS.ErrnoException).code==='EADDRINUSE'){console.error(`La aplicación ya está ejecutándose en el puerto ${config.PORT}. No inicies otra instancia.`);await closeDb(client);return}throw error}
  if(config.TELEGRAM_BOT_TOKEN){
    const allowedCount=parseAllowedTelegramUserIds(config.TELEGRAM_ALLOWED_USER_IDS).size;
    const bot=createTelegramBot(config,client.db,client.pool);
    console.log(JSON.stringify({event:'telegram_startup',token:'PRESENT',allowed_users_count:allowedCount,transport:'long_polling',webhook:'not_checked_in_startup_use_telegram_check'}));
    void client.db.execute(sql`INSERT INTO configuration(key,value) VALUES('TELEGRAM_POLLING_ACTIVE','false'),('TELEGRAM_POLLING_STARTED_AT',${new Date().toISOString()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    let heartbeatTimer:NodeJS.Timeout|undefined;
    void bot.start({
      onStart:async info=>{
        await client.db.execute(sql`INSERT INTO configuration(key,value) VALUES('TELEGRAM_POLLING_ACTIVE','true'),('TELEGRAM_POLLING_HEARTBEAT',${new Date().toISOString()}),('TELEGRAM_BOT_USERNAME',${info.username}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
        console.log(JSON.stringify({event:'telegram_polling_started',bot_username:info.username,transport:'long_polling'}));
        heartbeatTimer=setInterval(()=>void client.db.execute(sql`INSERT INTO configuration(key,value) VALUES('TELEGRAM_POLLING_HEARTBEAT',${new Date().toISOString()}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`),15000);
      }
    }).catch(async error=>{
      if(heartbeatTimer)clearInterval(heartbeatTimer);
      await client.db.execute(sql`INSERT INTO configuration(key,value) VALUES('TELEGRAM_POLLING_ACTIVE','false'),('TELEGRAM_LAST_ERROR',${String(error)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
      console.error(JSON.stringify({event:'telegram_polling_error',error:String(error),conflict:String(error).includes('409')}));
    });
  }
}
main().catch(async error=>{console.error(error);await closeDb(client);process.exitCode=1});
