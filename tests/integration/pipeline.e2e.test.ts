import {describe,expect,it,beforeAll,afterAll,beforeEach} from 'vitest';
import {createDb,closeDb} from '../../src/db/client.js';
import {migrate} from '../../src/db/migrate.js';
import {discoveryHandler} from '../../src/jobs/handlers/discovery-handler.js';
import {crawlHandler} from '../../src/jobs/handlers/crawl-handler.js';
import {researchHandler} from '../../src/jobs/handlers/research-handler.js';
import {qualifyHandler} from '../../src/jobs/handlers/qualify-handler.js';
import {draftHandler} from '../../src/jobs/handlers/draft-handler.js';
import {sendHandler} from '../../src/jobs/handlers/send-handler.js';
import {replyPollHandler} from '../../src/jobs/handlers/reply-handler.js';
import {sheetsHandler} from '../../src/jobs/handlers/sheets-handler.js';
import type {Config} from '../../src/config.js';
import type {DiscoveryProvider} from '../../src/discovery/types.js';
import type {ResearchProvider} from '../../src/qualification/ai-research.js';
import type {PageSnapshot} from '../../src/crawler/website.js';
import type {JobDependencies} from '../../src/jobs/dependencies.js';

const url=process.env.TEST_DATABASE_URL;const enabled=process.env.RUN_PG_INTEGRATION==='1'&&Boolean(url);
const testConfig={DATABASE_URL:url??'',OUTREACH_MODE:'AUTO',OUTREACH_ENABLED:true,AUTO_SEND_THRESHOLD:82,REVIEW_THRESHOLD:60,DAILY_SEND_LIMIT:5,HOURLY_SEND_LIMIT:2,BASE_LOCATION:'CABA',SERVICE_COVERAGE:'CABA,GBA,AMBA',MAX_PAGES_PER_DOMAIN:10,DISCOVERY_MAX_SEARCH_REQUESTS:5,DISCOVERY_MAX_RUNTIME_SECONDS:30,DISCOVERY_MAX_NEW_COMPANIES:10,DISCOVERY_MIN_MARGINAL_NOVELTY:0.1,SERVICE_PROFILE_JSON:JSON.stringify({vehicle:'Renault Master refrigerada',temperatureCapability:'-18 a 4 C',coverage:['CABA','GBA'],contactPerson:'Operaciones'}),SENDER_NAME:'Renault Master',PORT:3001,SCHEDULER_DISCOVERY_CRON:'* * * * *',SCHEDULER_REPLY_CRON:'* * * * *',SCHEDULER_FOLLOWUP_CRON:'* * * * *',SCHEDULER_SHEETS_CRON:'* * * * *'} as Config;
const client=enabled?createDb(testConfig):undefined;
describe.skipIf(!enabled)('pipeline E2E con PostgreSQL real y providers fake',()=>{
  beforeAll(async()=>{await migrate(client!.pool)});
  beforeEach(async()=>{await client!.pool.query('TRUNCATE companies,campaigns,runs,jobs,configuration,operational_state RESTART IDENTITY CASCADE');await client!.pool.query("INSERT INTO operational_state(id,state) VALUES(true,'RUNNING') ON CONFLICT(id) DO UPDATE SET state='RUNNING'")});
  afterAll(async()=>{await closeDb(client!)});
  it('descubre, clasifica, investiga, califica AUTO, envia una vez, procesa reply y notifica',async()=>{
    let sends=0;let syncs=0;const events:string[]=[];let replyAvailable=true;let threadId='';
    const provider:DiscoveryProvider={name:'brave-search',async search(){return[{name:'Distribucion HORECA de productos ultracongelados',website:'https://frozen.example.com',sourceType:'WEB_SEARCH',sourceUrl:'https://frozen.example.com',metadata:{description:'Distribucion HORECA de productos ultracongelados en CABA'}}]}};
    const crawler={crawl:async(_url:string):Promise<PageSnapshot[]>=>[{url:'https://frozen.example.com/contacto',title:'Frozen HORECA',text:'Distribucion de productos ultracongelados para HORECA en CABA y GBA. ventas@frozen.example.com',status:200,sourceType:'HTTP',links:[],contactSignals:['ventas','mailto'],businessSignals:['distribucion','ultracongelados'],observedAt:new Date().toISOString()}]};
    const research:ResearchProvider={async research(input){return{companyType:'DISTRIBUTOR',relevance:0.95,summary:'Distribuidor HORECA con senales de frio.',detectedSignals:input.evidence.map(e=>({evidenceId:e.id,signal:'cold-chain'})),reasoningSummary:'evidence-backed',recommendedAction:'CONTACT',confidence:'HIGH',businessModel:'HORECA distribution',distributionModel:'own delivery',geography:'CABA/GBA',potentialTransportNeed:'refrigerated delivery',uncertainties:[]}}};
    const gmail={send:async()=>{sends++;threadId='thread-1';return{messageId:'gmail-1',threadId}},listInbox:async()=>replyAvailable?[{id:'reply-1'}]:[],getMessage:async(id:string)=>({id,threadId,body:'Estamos interesados, llamame para avanzar',from:'compras@frozen.example.com'})};
    const deps:JobDependencies={providers:[provider],crawler,research,gmail,sheets:{syncDatabase:async()=>{syncs++}} as any,notifier:{notify:async(_event,message)=>{events.push(message)}},classifyReply:async()=>({classification:'INTERESTED',summary:'interes'})};
    await discoveryHandler(client!.db,testConfig,{id:'j1',payload:{query:'frozen horeca'}},deps);const company=(await client!.pool.query('SELECT id FROM companies LIMIT 1')).rows[0];expect(company).toBeTruthy();
    await crawlHandler(client!.db,testConfig,{id:'j2',payload:{companyId:company.id,website:'https://frozen.example.com'}},deps);await researchHandler(client!.db,testConfig,{id:'j3',payload:{companyId:company.id}},deps);await qualifyHandler(client!.db,testConfig,{id:'j4',payload:{companyId:company.id}},deps);expect((await client!.pool.query("SELECT decision FROM qualifications WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1",[company.id])).rows[0].decision).toBe('AUTO_ELIGIBLE');
    await draftHandler(client!.db,testConfig,{id:'j5',payload:{companyId:company.id}},deps);const message=(await client!.pool.query("SELECT id FROM messages WHERE company_id=$1",[company.id])).rows[0];expect(message).toBeTruthy();await sendHandler(client!.db,testConfig,{id:'j6',payload:{companyId:company.id,messageId:message.id}},deps);await sendHandler(client!.db,testConfig,{id:'j7',payload:{companyId:company.id,messageId:message.id}},deps);expect(sends).toBe(1);expect((await client!.pool.query('SELECT outbound_state FROM messages WHERE id=$1',[message.id])).rows[0].outbound_state).toBe('SENT');
    await replyPollHandler(client!.db,testConfig,{id:'j8',payload:{}},deps);replyAvailable=false;expect((await client!.pool.query("SELECT status FROM message_sequences WHERE company_id=$1",[company.id])).rows[0].status).toBe('STOPPED');expect((await client!.pool.query('SELECT classification FROM replies WHERE company_id=$1',[company.id])).rows[0].classification).toBe('INTERESTED');expect(events.some(event=>event.includes('Respuesta'))).toBe(true);await sheetsHandler(client!.db,testConfig,{id:'j9',payload:{}},deps);await sheetsHandler(client!.db,testConfig,{id:'j10',payload:{}},deps);expect(syncs).toBe(2);
  });
});
