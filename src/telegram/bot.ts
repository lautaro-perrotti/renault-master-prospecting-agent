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
import {leadKeyboard,leadListKeyboard,leadMessageKeyboard,mainMenuKeyboard,modeConfirmKeyboard,modeKeyboard,modeLabel,opportunitiesKeyboard,replyListKeyboard,searchKeyboard,stateLabel,statusKeyboard,statusLabel,settingsKeyboard,transportTypeLabel} from './presentation.js';

export function parseAllowedTelegramUserIds(value?:string):Set<number>{
  return new Set((value??'').split(',').map(item=>Number(item.trim())).filter(item=>Number.isSafeInteger(item)&&item>0));
}

function updateType(update:Record<string,unknown>):string{return ['message','edited_message','channel_post','edited_channel_post','callback_query','inline_query','chosen_inline_result'].find(key=>key in update)??'unknown'}
function commandFromContext(ctx:any):string|undefined{const text=ctx.message?.text;return typeof text==='string'?text.match(/^\/(\w+)/)?.[1]:undefined}
function errorMessage(error:unknown):string{return error instanceof Error?error.message:String(error)}
function replyClassLabel(value:string):string{const labels:Record<string,string>={INTERESTED:'Interesado',QUESTION:'Consulta',NOT_INTERESTED:'No interesado',OPT_OUT:'Pidió no contactar',AUTO_REPLY:'Respuesta automática',BOUNCE:'Correo rechazado',UNKNOWN:'Sin clasificar'};return labels[value]??'Sin clasificar'}
function providerLabel(config:Config):string{return `Brave: ${config.BRAVE_SEARCH_API_KEY?'disponible':'no configurado'} · Google Places: ${config.GOOGLE_MAPS_API_KEY?'disponible':'no configurado'}`}

type Reply={text:string;options?:Record<string,unknown>};
type CommandHandler=(ctx:any)=>Promise<string|Reply|undefined>;

export function createTelegramBot(config:Config,db:Db,pool?:Pool){
  if(!config.TELEGRAM_BOT_TOKEN)throw new Error('NOT_CONFIGURED: TELEGRAM_BOT_TOKEN');
  const allowed=parseAllowedTelegramUserIds(config.TELEGRAM_ALLOWED_USER_IDS);
  const bot=new Bot(config.TELEGRAM_BOT_TOKEN);
  const actions=new LeadActions(db);
  const pendingSearches=new Set<number>();
  const log=(event:string,details:Record<string,unknown>={})=>console.log(JSON.stringify({event,at:new Date().toISOString(),...details}));
  const record=async(key:string,value:unknown)=>{try{await db.execute(sql`INSERT INTO configuration(key,value) VALUES(${key},${String(value)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)}catch(error){console.error(JSON.stringify({event:'telegram_runtime_state_error',key,error:errorMessage(error)}))}};

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
      if(config.TELEGRAM_DEBUG_AUTH&&ctx.chat?.id){await ctx.reply(`Unauthorized Telegram user. Your Telegram user ID is: ${String(fromUserId??'unknown')}`);log('telegram_response_sent',{chat_id:ctx.chat.id,response:'unauthorized_user_id'})}
      return;
    }
    await next();
  });

  const command=(name:string,handler:CommandHandler)=>bot.command(name,async ctx=>{
    log('telegram_command',{command:`/${name}`,userId:ctx.from?.id??null});
    const result=await handler(ctx);
    if(result){const response=typeof result==='string'?{text:result}:result;await ctx.reply(response.text,response.options);log('telegram_response_sent',{command:`/${name}`,chat_id:ctx.chat?.id??null})}
  });
  const edit=async(ctx:any,response:Reply)=>{await ctx.editMessageText(response.text,response.options);log('telegram_response_sent',{callback:ctx.callbackQuery?.data??null,chat_id:ctx.chat?.id??null})};
  const callbackReply=async(ctx:any,response:Reply)=>{await ctx.answerCallbackQuery();await edit(ctx,response)};

  const mainMenu=async():Promise<Reply>=>{const state=await getOperationalState(db);const mode=await effectiveMode(db,config);return {text:`\uD83D\uDE90 Renault Master \u2014 Asistente comercial\n\nBusco oportunidades de transporte, investigo empresas y organizo los contactos.\n\nEstado: ${stateLabel(state)}\nModo: ${modeLabel(mode)}\n\n\u00bfQu\u00e9 quer\u00e9s hacer?`,options:{reply_markup:mainMenuKeyboard()}}};
  const searchMenu=():Reply=>({text:'\uD83D\DD0E Buscar oportunidades\n\nPod\u00e9s buscar empresas y necesidades de transporte en CABA y GBA.\n\nEleg\u00ed una opci\u00f3n:',options:{reply_markup:searchKeyboard()}});
  const queueSearch=async(query:string|undefined,userId:number):Promise<string>=>{if(!config.BRAVE_SEARCH_API_KEY&&!config.GOOGLE_MAPS_API_KEY)return `No puedo iniciar la b\u00fasqueda todav\u00eda: no hay proveedores configurados.\n${providerLabel(config)}`;await enqueue(db,'DISCOVERY',{query,requestedBy:String(userId)},new Date(),{idempotencyKey:`DISCOVERY:USER:${query??'default'}:${new Date().toISOString().slice(0,16)}`});return `\uD83D\DD0E B\u00fasqueda iniciada\n\nVoy a explorar empresas y se\u00f1ales compatibles con la Renault Master. Te aviso cuando encuentre oportunidades relevantes.`};

  const opportunityCounts=async()=>{const result=await db.execute(sql`SELECT count(*) FILTER(WHERE COALESCE(q.total,0)>=${config.AUTO_SEND_THRESHOLD})::int AS best,count(*) FILTER(WHERE q.decision='REVIEW' OR c.status='REVIEW')::int AS review,count(*) FILTER(WHERE c.status IN ('SENT','SEQUENCE_ACTIVE'))::int AS contacted,count(*) FILTER(WHERE c.status='REPLIED')::int AS replied FROM companies c LEFT JOIN LATERAL(SELECT total,decision FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1) q ON true WHERE c.status NOT IN ('BLOCKED','DISCARDED')`);return result.rows[0] as any};
  const opportunityMenu=async():Promise<Reply>=>{const counts=await opportunityCounts();return {text:`\uD83D\DCCB Oportunidades\n\n\uD83D\DFE2 Buenas: ${counts.best??0}\n\uD83D\DFE1 Para revisar: ${counts.review??0}\n\uD83D\DD35 Contactadas: ${counts.contacted??0}\n\uD83D\DCAC Respondieron: ${counts.replied??0}\n\nEleg\u00ed una vista:`,options:{reply_markup:opportunitiesKeyboard()}}};
  const listOpportunities=async(filter:'best'|'review'|'contacted'|'replied'|'all'):Promise<Reply>=>{
    const where=filter==='best'?sql`AND COALESCE(q.total,0)>=${config.AUTO_SEND_THRESHOLD}`:filter==='review'?sql`AND (q.decision='REVIEW' OR c.status='REVIEW')`:filter==='contacted'?sql`AND c.status IN ('SENT','SEQUENCE_ACTIVE')`:filter==='replied'?sql`AND c.status='REPLIED'`:sql``;
    const result=await db.execute(sql`SELECT c.id,c.name,c.address,c.status,COALESCE(q.total,0)::int AS total FROM companies c LEFT JOIN LATERAL(SELECT total,decision FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)q ON true WHERE c.status NOT IN ('BLOCKED','DISCARDED') ${where} ORDER BY COALESCE(q.total,0) DESC,c.updated_at DESC LIMIT 10`);
    const rows=result.rows as any[];const title={best:'Mejores oportunidades',review:'Para revisar',contacted:'Contactadas',replied:'Con respuesta',all:'Oportunidades'}[filter];
    if(!rows.length)return {text:`\uD83D\DCCB ${title}\n\nNo hay oportunidades para mostrar.`,options:{reply_markup:opportunitiesKeyboard()}};
    const body=rows.map(row=>`\uD83C\DFE2 ${row.name}\n\uD83D\DCCD ${row.address??'Ubicaci\u00f3n no informada'}\n\uD83C\DFAF Compatibilidad: ${row.total}/100\nEstado: ${statusLabel(row.status)}`).join('\n\n');
    return {text:`\uD83D\DCCB ${title}\n\n${body}`,options:{reply_markup:leadListKeyboard(rows)}};
  };

  const inferTransportType=(evidence:any[],explicit?:string)=>{if(explicit)return transportTypeLabel(explicit);const text=evidence.map(item=>`${item.signal_type} ${item.excerpt}`).join(' ').toLowerCase();if(/refriger|congel|cadena de fr\u00edo|ultracongel|l\u00e1cte/.test(text))return 'Refrigerado';if(/distribu|entrega|mayorista|log\u00edst|repart/.test(text))return 'Transporte convencional';return 'Sin clasificar'};
  const leadDetail=async(id:string):Promise<Reply>=>{const company=(await db.execute(sql`SELECT c.*,q.total,q.decision,q.reasoning FROM companies c LEFT JOIN LATERAL(SELECT total,decision,reasoning FROM qualifications WHERE company_id=c.id ORDER BY created_at DESC LIMIT 1)q ON true WHERE c.id=${id}`)).rows[0] as any;if(!company)return {text:'No encontr\u00e9 esa oportunidad.',options:{reply_markup:opportunitiesKeyboard()}};const evidence=(await db.execute(sql`SELECT signal_type,excerpt FROM evidence WHERE company_id=${id} ORDER BY observed_at DESC LIMIT 5`)).rows as any[];const contact=(await db.execute(sql`SELECT email,phone,verification_status FROM contacts WHERE company_id=${id} AND invalid=false ORDER BY verified DESC,email NULLS LAST LIMIT 1`)).rows[0] as any;const reasons=evidence.slice(0,3).map(item=>`\u2022 ${item.excerpt}`).join('\n')||'\u2022 Todav\u00eda no hay evidencia resumida.';return {text:`\uD83C\DFE2 ${company.name}\n\uD83D\DCCD ${company.address??'Ubicaci\u00f3n no informada'}\n\uD83C\DFAF Compatibilidad: ${company.total??'sin puntaje'}/100\n\uD83D\DE9A Tipo: ${inferTransportType(evidence,company.transport_type)}\n\nPor qu\u00e9 puede interesar\n${reasons}\n\n\uD83D\DCE7 ${contact?.email??'Contacto comercial no disponible'}\n\uD83C\DF10 ${company.website??'Sitio web no informado'}\nEstado: ${statusLabel(company.status)}`,options:{reply_markup:leadKeyboard(id)}}};
  const leadMessage=async(id:string):Promise<Reply>=>{const company=(await db.execute(sql`SELECT name FROM companies WHERE id=${id}`)).rows[0] as any;const message=(await db.execute(sql`SELECT to_email,body,outbound_state FROM messages WHERE company_id=${id} AND direction='OUTBOUND' ORDER BY prepared_at DESC NULLS LAST,id DESC LIMIT 1`)).rows[0] as any;if(!company||!message)return {text:'Todav\u00eda no hay un mensaje preparado para esta oportunidad.',options:{reply_markup:leadKeyboard(id)}};return {text:`\u2709\uFE0F Mensaje preparado\n\nEmpresa: ${company.name}\nPara: ${message.to_email??'Contacto no disponible'}\nEstado: ${statusLabel(message.outbound_state)}\n\n${message.body}`,options:{reply_markup:leadMessageKeyboard(id)}}};
  const statusView=async():Promise<Reply>=>{const state=await getOperationalState(db);const counts=await db.execute(sql`SELECT count(*) FILTER(WHERE created_at>=current_date)::int AS found,count(*) FILTER(WHERE updated_at>=current_date AND status IN ('QUALIFIED','REVIEW','APPROVED','DRAFTED'))::int AS relevant,count(*) FILTER(WHERE updated_at>=current_date AND status IN ('SENT','SEQUENCE_ACTIVE'))::int AS contacted,count(*) FILTER(WHERE updated_at>=current_date AND status='REPLIED')::int AS replied FROM companies`);const row=counts.rows[0] as any;return {text:`\uD83D\DCCA Estado del agente\n\n${stateLabel(state)}\n\uD83C\DFAF Modo: ${modeLabel(await effectiveMode(db,config))}\n\nHoy\n\uD83D\DD0E ${row.found??0} empresas encontradas\n\uD83C\DFAF ${row.relevant??0} oportunidades relevantes\n\u2709\uFE0F ${row.contacted??0} contactos realizados\n\uD83D\DCAC ${row.replied??0} respuestas recibidas`,options:{reply_markup:statusKeyboard(state)}}};
  const settingsView=async():Promise<Reply>=>({text:`\u2699\uFE0F Configuraci\u00f3n\n\n\uD83C\DFAF Modo actual: ${modeLabel(await effectiveMode(db,config))}\n\uD83D\DCCD Zona: ${config.SERVICE_COVERAGE.replaceAll(',', ' + ')}\n\u2709\uFE0F L\u00edmite diario: ${config.DAILY_SEND_LIMIT} contactos\n\uD83D\uDD50 L\u00edmite por hora: ${config.HOURLY_SEND_LIMIT} contactos`,options:{reply_markup:settingsKeyboard()}});
  const repliesView=async():Promise<Reply>=>{const result=await db.execute(sql`SELECT r.company_id,c.name,r.classification,r.body,r.received_at FROM replies r JOIN companies c ON c.id=r.company_id ORDER BY r.received_at DESC LIMIT 5`);const rows=result.rows as any[];if(!rows.length)return {text:'\uD83D\DCAC Respuestas\n\nTodav\u00eda no hay respuestas recibidas.',options:{reply_markup:mainMenuKeyboard()}};return {text:`\uD83D\DCAC Respuestas\n\n${rows.map(row=>`\uD83C\DFE2 ${row.name}\nClasificaci\u00f3n: ${replyClassLabel(row.classification)}\n${String(row.body).slice(0,280)}`).join('\n\n')}`,options:{reply_markup:replyListKeyboard(rows)}}};
  const replyDetail=async(companyId:string):Promise<Reply>=>{const row=(await db.execute(sql`SELECT c.name,r.classification,r.body FROM replies r JOIN companies c ON c.id=r.company_id WHERE r.company_id=${companyId} ORDER BY r.received_at DESC LIMIT 1`)).rows[0] as any;if(!row)return repliesView();return {text:`\uD83D\DD25 Nueva respuesta\n\n\uD83C\DFE2 ${row.name}\n\n${row.body}\n\nClasificaci\u00f3n: ${replyClassLabel(row.classification)}\nEl seguimiento autom\u00e1tico fue detenido.`,options:{reply_markup:new InlineKeyboard().text('\u2705 Marcar como oportunidad',`lead:${companyId}:detail`).row().text('\u21A9\uFE0F Volver','menu:replies')}}};
  const helpView=():Reply=>({text:'\u00bfQu\u00e9 puedo hacer?\n\n\uD83D\DD0E Buscar oportunidades\nEncuentro empresas y necesidades de transporte.\n\n\uD83D\DCCB Revisar oportunidades\nTe muestro las empresas con mayor compatibilidad.\n\n\u2709\uFE0F Contactar empresas\nPreparo mensajes para revisarlos antes de contactar.\n\n\uD83D\DCAC Gestionar respuestas\nTe aviso cuando una empresa responde.\n\n\uD83D\DCCA Ver estado\nConsult\u00e1 actividad, modo y resultados.\n\nUs\u00e1 los botones o escrib\u00ed lo que necesit\u00e1s.',options:{reply_markup:mainMenuKeyboard()}});

  const persistMode=async(mode:'MANUAL'|'SEMI_AUTO'|'AUTO')=>{await db.execute(sql`INSERT INTO configuration(key,value) VALUES('OUTREACH_MODE',${mode}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);config.OUTREACH_MODE=mode;return mode};
  const modeDescription=(mode:string)=>mode==='AUTO'?'El agente podr\u00e1 buscar, investigar y contactar autom\u00e1ticamente oportunidades de alta compatibilidad dentro de los l\u00edmites configurados.':mode==='SEMI_AUTO'?'El agente buscar\u00e1 e investigar\u00e1 oportunidades, y te pedir\u00e1 aprobaci\u00f3n antes de contactar.':'El agente preparar\u00e1 oportunidades y mensajes para que vos decidas cada contacto.';

  command('start',async()=>mainMenu());command('inicio',async()=>mainMenu());
  command('help',async()=>helpView());command('ayuda',async()=>helpView());
  command('buscar',async ctx=>ctx.match?.trim()?queueSearch(ctx.match.trim(),Number(ctx.from?.id)):searchMenu());
  command('oportunidades',async()=>opportunityMenu());command('respuestas',async()=>repliesView());command('estado',async()=>statusView());command('configuracion',async()=>settingsView());
  command('pausar',async ctx=>{await actions.state('PAUSED',String(ctx.from?.id));return statusView()});command('reanudar',async ctx=>{await actions.state('RUNNING',String(ctx.from?.id));return statusView()});

  command('status',async()=>statusView());command('stats',async()=>{const r=await db.execute(sql`SELECT status,count(*)::int AS n FROM companies GROUP BY status ORDER BY status`);return (r.rows as any[]).map(x=>`${statusLabel(x.status)}: ${x.n}`).join('\n')||'Sin datos'});
  const search=async(ctx:any)=>ctx.match?.trim()?queueSearch(ctx.match.trim(),Number(ctx.from?.id)):queueSearch(undefined,Number(ctx.from?.id));command('search',search);command('discovery',search);
  command('leads',async ctx=>listOpportunities(ctx.match?.trim()==='review'?'review':ctx.match?.trim()==='auto'?'best':'all'));command('lead',async ctx=>ctx.match?.trim()?leadDetail(ctx.match.trim()):'Uso: /lead <id>');
  command('why',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /why <id>';const q=(await db.execute(sql`SELECT total,decision,reasoning FROM qualifications WHERE company_id=${id} ORDER BY created_at DESC LIMIT 1`)).rows[0] as any;const e=await db.execute(sql`SELECT id,title,source_url,signal_type,excerpt FROM evidence WHERE company_id=${id} ORDER BY observed_at DESC LIMIT 10`);return JSON.stringify({qualification:q??null,evidence:e.rows},null,2).slice(0,3900)});
  command('research',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /research <id>';await actions.research(id);return 'Investigaci\u00f3n iniciada. Te aviso cuando haya novedades.'});
  command('send',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /send <id>';try{await actions.send(id,String(ctx.from?.id));return 'Contacto aprobado para procesamiento. El env\u00edo queda sujeto a la configuraci\u00f3n de outreach.'}catch(error){return `No se pudo preparar el contacto: ${errorMessage(error)}`} });
  command('skip',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /skip <id>';await actions.skip(id);return 'Oportunidad descartada.'});command('block',async ctx=>{const id=ctx.match?.trim();if(!id)return 'Uso: /block <id>';await actions.block(id);return 'La empresa qued\u00f3 bloqueada y no volver\u00e1 a contactarse.'});
  command('replies',async()=>repliesView());command('errors',async()=>{const r=await db.execute(sql`SELECT type,last_error FROM jobs WHERE status='DEAD' ORDER BY run_at DESC LIMIT 10`);return (r.rows as any[]).map(x=>`${x.type}: ${x.last_error}`).join('\n')||'No hay errores pendientes.'});
  command('pause',async ctx=>{await actions.state('PAUSED',String(ctx.from?.id));return 'Sistema pausado.'});command('resume',async ctx=>{await actions.state('RUNNING',String(ctx.from?.id));return 'Sistema reanudado.'});command('stop',async ctx=>{await actions.state('STOPPED',String(ctx.from?.id));return 'Sistema detenido.'});
  command('mode',async ctx=>{const raw=ctx.match?.trim().toUpperCase().replace('SEMI','SEMI_AUTO');if(!['MANUAL','SEMI_AUTO','AUTO'].includes(raw??''))return 'Uso: /mode manual|semi|auto';await persistMode(raw as 'MANUAL'|'SEMI_AUTO'|'AUTO');return `Modo actualizado: ${modeLabel(raw)}`});
  command('config',async()=>JSON.stringify({mode:await effectiveMode(db,config),outreachEnabled:config.OUTREACH_ENABLED,autoThreshold:config.AUTO_SEND_THRESHOLD,reviewThreshold:config.REVIEW_THRESHOLD,dailyLimit:config.DAILY_SEND_LIMIT,hourlyLimit:config.HOURLY_SEND_LIMIT},null,2));command('doctor',async()=>JSON.stringify(await doctor(config,pool),null,2));

  bot.on('message:text',async ctx=>{const userId=ctx.from?.id;if(typeof userId!=='number'||!pendingSearches.has(userId))return;pendingSearches.delete(userId);await ctx.reply(await queueSearch(ctx.message.text.trim(),userId),{reply_markup:mainMenuKeyboard()});log('telegram_response_sent',{command:'free_text_search',chat_id:ctx.chat?.id??null})});

  bot.on('callback_query:data',async ctx=>{
    const data=ctx.callbackQuery.data;
    if(data==='menu:home')return callbackReply(ctx,await mainMenu());
    if(data==='menu:search')return callbackReply(ctx,searchMenu());
    if(data==='menu:opportunities')return callbackReply(ctx,await opportunityMenu());
    if(data==='menu:replies')return callbackReply(ctx,await repliesView());
    if(data==='menu:status')return callbackReply(ctx,await statusView());
    if(data==='menu:settings')return callbackReply(ctx,await settingsView());
    if(data==='menu:pause'){await actions.state('PAUSED',String(ctx.from?.id));return callbackReply(ctx,await statusView())}
    if(data==='menu:resume'){await actions.state('RUNNING',String(ctx.from?.id));return callbackReply(ctx,await statusView())}
    if(data==='search:auto'){return callbackReply(ctx,{text:`${await queueSearch(undefined,Number(ctx.from?.id))}\n\n${providerLabel(config)}`,options:{reply_markup:mainMenuKeyboard()}})}
    if(data==='search:write'){pendingSearches.add(Number(ctx.from?.id));await ctx.answerCallbackQuery();await ctx.reply('Escrib\u00ed qu\u00e9 quer\u00e9s buscar. Por ejemplo: distribuidores con reparto en Zona Norte.',{reply_markup:{force_reply:true,selective:true}});return}
    if(data.startsWith('opps:')){const filter=data.slice(5) as 'best'|'review'|'contacted'|'replied';return callbackReply(ctx,await listOpportunities(filter))}
    if(data==='settings:mode'){return callbackReply(ctx,{text:`\uD83C\DFAF Cambiar modo\n\nEleg\u00ed c\u00f3mo quer\u00e9s operar el agente.`,options:{reply_markup:modeKeyboard()}})}
    if(data==='settings:limits')return callbackReply(ctx,{text:`\u2709\uFE0F L\u00edmites\n\nL\u00edmite diario: ${config.DAILY_SEND_LIMIT} contactos\nL\u00edmite por hora: ${config.HOURLY_SEND_LIMIT} contactos`,options:{reply_markup:settingsKeyboard()}});
    if(data==='settings:zone')return callbackReply(ctx,{text:`\uD83D\DCCD Zona de trabajo\n\n${config.SERVICE_COVERAGE.replaceAll(',', ' + ')}`,options:{reply_markup:settingsKeyboard()}});
    if(data==='settings:blocked'){const count=await db.execute(sql`SELECT count(*)::int AS n FROM suppressions`);return callbackReply(ctx,{text:`\uD83D\DEAB Bloqueados\n\nHay ${(count.rows[0] as any).n} registros protegidos contra contacto.`,options:{reply_markup:settingsKeyboard()}})}
    if(data==='settings:doctor'){const report=await doctor(config,pool);const lines=Object.entries(report.checks).map(([name,status])=>`${status==='PASS'?'\uD83D\DFE2':status==='CONFIGURED'?'\uD83D\DFE1':'\uD83D\DD34'} ${name}: ${status==='PASS'?'OK':status==='CONFIGURED'?'Configurado':'No disponible'}`).join('\n');return callbackReply(ctx,{text:`\uD83D\DD27 Diagn\u00f3stico\n\n${lines}`,options:{reply_markup:settingsKeyboard()}})}
    const modeSelect=data.match(/^mode:select:(MANUAL|SEMI_AUTO|AUTO)$/);if(modeSelect)return callbackReply(ctx,{text:`Modo ${modeLabel(modeSelect[1])}\n\n${modeDescription(modeSelect[1])}`,options:{reply_markup:modeConfirmKeyboard(modeSelect[1])}});
    const modeConfirm=data.match(/^mode:confirm:(MANUAL|SEMI_AUTO|AUTO)$/);if(modeConfirm){await persistMode(modeConfirm[1] as 'MANUAL'|'SEMI_AUTO'|'AUTO');return callbackReply(ctx,await settingsView())}
    const replyMatch=data.match(/^reply:([^:]+)$/);if(replyMatch)return callbackReply(ctx,await replyDetail(replyMatch[1]));
    const leadMatch=data.match(/^lead:([^:]+):(.+)$/);if(leadMatch){const [,id,action]=leadMatch;if(action==='detail')return callbackReply(ctx,await leadDetail(id));if(action==='message')return callbackReply(ctx,await leadMessage(id));if(action==='edit')return callbackReply(ctx,{text:'La edici\u00f3n manual del mensaje estar\u00e1 disponible en una pr\u00f3xima iteraci\u00f3n.',options:{reply_markup:leadMessageKeyboard(id)}});if(action==='research'){await actions.research(id);return callbackReply(ctx,{text:'Investigaci\u00f3n iniciada. Te aviso cuando haya novedades.',options:{reply_markup:leadKeyboard(id)}})}if(action==='skip'){await actions.skip(id);return callbackReply(ctx,{text:'Oportunidad descartada.',options:{reply_markup:opportunitiesKeyboard()}})}if(action==='block'){await actions.block(id);return callbackReply(ctx,{text:'La empresa qued\u00f3 bloqueada y no volver\u00e1 a contactarse.',options:{reply_markup:opportunitiesKeyboard()}})}if(action==='send'){try{await actions.send(id,String(ctx.from?.id));return callbackReply(ctx,{text:'\u2705 Contacto aprobado. Queda sujeto a la configuraci\u00f3n de outreach antes de salir.',options:{reply_markup:leadKeyboard(id)}})}catch(error){return callbackReply(ctx,{text:`No se pudo preparar el contacto: ${errorMessage(error)}`,options:{reply_markup:leadKeyboard(id)}})}}}
    await ctx.answerCallbackQuery();
  });

  bot.catch(async error=>{const commandName=commandFromContext(error.ctx);log('telegram_handler_error',{command:commandName?`/${commandName}`:null,update_id:error.ctx.update.update_id,error:errorMessage(error.error)});try{await error.ctx.reply(config.TELEGRAM_DEBUG_AUTH&&commandName?`\u274C /${commandName} fall\u00f3: ${errorMessage(error.error)}`:'\u274C No pude completar esa acci\u00f3n. Revis\u00e1 los logs del runtime.')}catch(replyError){console.error(JSON.stringify({event:'telegram_error_response_failed',error:errorMessage(replyError)}))}});
  void record('TELEGRAM_ALLOWED_USER_COUNT',allowed.size);
  return bot;
}
