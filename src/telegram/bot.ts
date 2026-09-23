import {Bot,InlineKeyboard} from 'grammy';
import {sql} from 'drizzle-orm';
import type {Pool} from 'pg';
import type {Config} from '../config.js';
import type {Db} from '../db/client.js';
import {enqueue} from '../jobs/queue.js';
import {doctor} from '../integrations/health.js';
import {effectiveMode} from '../jobs/runtime-config.js';
import {getOperationalState} from '../operations/state.js';
import {LeadActions} from './actions.js';

export function parseAllowedTelegramUserIds(value?:string):Set<number>{
  return new Set((value??'').split(',').map(item=>Number(item.trim())).filter(item=>Number.isSafeInteger(item)&&item>0));
}

function updateType(update:Record<string,unknown>):string{
  return ['message','edited_message','channel_post','edited_channel_post','callback_query','inline_query','chosen_inline_result'].find(key=>key in update)??'unknown';
}

function commandFromContext(ctx:any):string|undefined{
  const text=ctx.message?.text;
  return typeof text==='string'?text.match(/^\/(\w+)/)?.[1]:undefined;
}

function errorMessage(error:unknown):string{return error instanceof Error?error.message:String(error)}

type Reply={text:string;options?:Record<string,unknown>};
type CommandHandler=(ctx:any)=>Promise<string|Reply|undefined>;

export function createTelegramBot(config:Config,db:Db,pool?:Pool){
  if(!config.TELEGRAM_BOT_TOKEN)throw new Error('NOT_CONFIGURED: TELEGRAM_BOT_TOKEN');
  const allowed=parseAllowedTelegramUserIds(config.TELEGRAM_ALLOWED_USER_IDS);
  const bot=new Bot(config.TELEGRAM_BOT_TOKEN);
  const actions=new LeadActions(db);

  const record=async(key:string,value:unknown)=>{
    try{await db.execute(sql`INSERT INTO configuration(key,value) VALUES(${key},${String(value)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)}
    catch(error){console.error(JSON.stringify({event:'telegram_runtime_state_error',key,error:errorMessage(error)}))}
  };
  const log=(event:string,details:Record<string,unknown>={})=>console.log(JSON.stringify({event,at:new Date().toISOString(),...details}));

  bot.use(async(ctx,next)=>{
    const update=ctx.update as unknown as Record<string,unknown>;
    const fromUserId=ctx.from?.id;
    const text=typeof ctx.message?.text==='string'?ctx.message.text.trim().slice(0,120):undefined;
    log('telegram_update_received',{update_id:update.update_id,update_type:updateType(update),chat_id:ctx.chat?.id??null,from_user_id:fromUserId??null,username:ctx.from?.username??null,command:text?.startsWith('/')?text.split(/\s+/)[0]:null,text:text&&!text.startsWith('/')?text:null});
    await record('TELEGRAM_LAST_UPDATE_AT',new Date().toISOString());
    const userId=typeof fromUserId==='number'?fromUserId:undefined;
    const authorized=allowed.size===0||(userId!==undefined&&allowed.has(userId));
    log('telegram_auth_check',{fromUserId:userId??null,allowed:authorized,configuredAllowedUserIds:allowed.size});
    if(!authorized){
      console.warn(`Telegram user ${String(fromUserId??'unknown')} rejected by TELEGRAM_ALLOWED_USER_IDS`);
      if(config.TELEGRAM_DEBUG_AUTH&&ctx.chat?.id){const response=`Unauthorized Telegram user. Your Telegram user ID is: ${String(fromUserId??'unknown')}`;await ctx.reply(response);log('telegram_response_sent',{chat_id:ctx.chat.id,response:'unauthorized_user_id'});}
      return;
    }
    await next();
  });

  const command=(name:string,handler:CommandHandler)=>bot.command(name,async ctx=>{
    log('telegram_command',{command:`/${name}`,userId:ctx.from?.id??null});
    const result=await handler(ctx);
    if(result){const reply=typeof result==='string'?{text:result}:result;await ctx.reply(reply.text,reply.options);log('telegram_response_sent',{command:`/${name}`,chat_id:ctx.chat?.id??null});}
  });

  command('start',async()=>`Agente Renault Master activo. Modo: ${await effectiveMode(db,config)}. Usa /help.`);
  command('help',async()=>'/status /stats /search <query> /discovery <query> /leads [review|auto] /lead <id> /why <id> /research <id> /send <id> /skip <id> /block <id> /replies /errors /pause /resume /stop /mode manual|semi|auto /config /doctor');
  command('status',async()=>{const r=await db.execute(sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='REVIEW')::int AS review,count(*) FILTER(WHERE status='SENT')::int AS sent FROM companies`);return `AGENTE ACTIVO\nEstado: ${await getOperationalState(db)}\nModo: ${await effectiveMode(db,config)}\nTelegram polling: ${config.TELEGRAM_BOT_TOKEN?'CONFIGURADO':'NO_CONFIGURADO'}\nÚltima actualización: ${(await db.execute(sql`SELECT value FROM configuration WHERE key='TELEGRAM_LAST_UPDATE_AT'`)).rows[0]?.value??'ninguna'}\nLeads: ${(r.rows[0] as any).total}\nReview: ${(r.rows[0] as any).review}\nEnviados: ${(r.rows[0] as any).sent}`});

  command('stats',async()=>{const r=await db.execute(sql`SELECT status,count(*)::int AS n FROM companies GROUP BY status ORDER BY status`);return (r.rows as any[]).map(x=>`${x.status}: ${x.n}`).join('\n')||'Sin datos'});
  const search=async(ctx:any)=>{
    const query=ctx.match?.trim()||undefined;
    const providers=[config.BRAVE_SEARCH_API_KEY?'Brave PASS':'Brave NOT_CONFIGURED',config.GOOGLE_MAPS_API_KEY?'Google Places PASS':'Google Places NOT_CONFIGURED'];
    if(!config.BRAVE_SEARCH_API_KEY&&!config.GOOGLE_MAPS_API_KEY)return `Discovery no ejecutado: no hay proveedores configurados. ${providers.join('; ')}.`;
    await enqueue(db,'DISCOVERY',{query,requestedBy:String(ctx.from?.id)},new Date(),{idempotencyKey:`DISCOVERY:USER:${query??'default'}:${new Date().toISOString().slice(0,16)}`});
    return `Discovery encolado${query?`: ${query}`:''}. ${providers.join('; ')}.`;
  };
  command('search',search);command('discovery',search);
  command('leads',async ctx=>{const filter=ctx.match?.trim();const where=filter==='review'?sql`WHERE c.status='REVIEW'`:filter==='auto'?sql`WHERE c.status='QUALIFIED'`:sql``;const r=await db.execute(sql`SELECT c.id,c.name,c.status,COALESCE(q.total,0) AS score FROM companies c LEFT JOIN LATERAL(SELECT total FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)q ON true ${where} ORDER BY c.updated_at DESC LIMIT 20`);return (r.rows as any[]).map(x=>`${x.id} - ${x.name} - ${x.status} - ${x.score}`).join('\n')||'Sin leads'});
  command('lead',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /lead <id>';const r=await db.execute(sql`SELECT c.*,q.total,q.decision FROM companies c LEFT JOIN LATERAL(SELECT total,decision FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)q ON true WHERE c.id=${id}`);const x=r.rows[0] as any;if(!x)return 'Lead no encontrado';return {text:`${x.name}\n${x.address??''}\n${x.website??''}\nScore: ${x.total??'pendiente'}\nEstado: ${x.status}`,options:{reply_markup:new InlineKeyboard().text('SEND',`lead:${id}:send`).text('RESEARCH',`lead:${id}:research`).row().text('SKIP',`lead:${id}:skip`).text('BLOCK',`lead:${id}:block`)}}});
  command('why',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /why <id>';const q=(await db.execute(sql`SELECT total,decision,reasoning FROM qualifications WHERE company_id=${id} ORDER BY created_at DESC LIMIT 1`)).rows[0] as any;const e=await db.execute(sql`SELECT id,title,source_url,signal_type,excerpt FROM evidence WHERE company_id=${id} ORDER BY observed_at DESC LIMIT 10`);return JSON.stringify({qualification:q??null,evidence:e.rows},null,2).slice(0,3900)});
  command('research',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /research <id>';await actions.research(id);return 'Research encolado.'});
  command('send',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /send <id>';try{await actions.send(id,String(ctx.from?.id));return 'Envío encolado para validar policy, supresión y límites.'}catch(error){return `No se pudo encolar: ${errorMessage(error)}`}});
  command('skip',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /skip <id>';await actions.skip(id);return 'Lead descartado.'});
  command('block',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /block <id>';await actions.block(id);return 'Lead bloqueado y suprimido.'});
  command('replies',async()=> 'Las respuestas se procesan mediante CHECK_REPLIES.');
  command('errors',async()=>{const r=await db.execute(sql`SELECT type,last_error FROM jobs WHERE status='DEAD' ORDER BY run_at DESC LIMIT 10`);return (r.rows as any[]).map(x=>`${x.type}: ${x.last_error}`).join('\n')||'Sin errores DEAD'});
  command('pause',async ctx=>{await actions.state('PAUSED',String(ctx.from?.id));return 'Sistema pausado: no se ejecutan nuevos discovery ni outreach.'});
  command('resume',async ctx=>{await actions.state('RUNNING',String(ctx.from?.id));return 'Sistema reanudado.'});
  command('stop',async ctx=>{await actions.state('STOPPED',String(ctx.from?.id));return 'Sistema detenido: no se envían correos ni follow-ups.'});
  command('mode',async ctx=>{const raw=ctx.match?.trim().toUpperCase().replace('SEMI','SEMI_AUTO');if(!['MANUAL','SEMI_AUTO','AUTO'].includes(raw??''))return 'Uso: /mode manual|semi|auto';await db.execute(sql`INSERT INTO configuration(key,value) VALUES('OUTREACH_MODE',${raw}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);config.OUTREACH_MODE=raw as Config['OUTREACH_MODE'];return `Modo actualizado: ${raw}`});
  command('config',async()=>JSON.stringify({mode:await effectiveMode(db,config),outreachEnabled:config.OUTREACH_ENABLED,autoThreshold:config.AUTO_SEND_THRESHOLD,reviewThreshold:config.REVIEW_THRESHOLD,dailyLimit:config.DAILY_SEND_LIMIT,hourlyLimit:config.HOURLY_SEND_LIMIT,telegramDebugAuth:config.TELEGRAM_DEBUG_AUTH},null,2));
  command('doctor',async()=>JSON.stringify(await doctor(config,pool),null,2));

  bot.callbackQuery(/^lead:(.+):(send|skip|research|block)$/,async ctx=>{const [,id,action]=ctx.match;if(action==='send')await actions.send(id,String(ctx.from?.id));if(action==='skip')await actions.skip(id);if(action==='block')await actions.block(id);if(action==='research')await actions.research(id);await ctx.answerCallbackQuery();await ctx.editMessageReplyMarkup({reply_markup:new InlineKeyboard()})});
  bot.catch(async error=>{
    const commandName=commandFromContext(error.ctx);
    log('telegram_handler_error',{command:commandName?`/${commandName}`:null,update_id:error.ctx.update.update_id,error:errorMessage(error.error)});
    try{await error.ctx.reply(config.TELEGRAM_DEBUG_AUTH&&commandName?`❌ /${commandName} failed: ${errorMessage(error.error)}`:'❌ Telegram command failed. Revisá los logs del runtime.')}catch(replyError){console.error(JSON.stringify({event:'telegram_error_response_failed',error:errorMessage(replyError)}))}
  });
  void record('TELEGRAM_ALLOWED_USER_COUNT',allowed.size);
  return bot;
}
