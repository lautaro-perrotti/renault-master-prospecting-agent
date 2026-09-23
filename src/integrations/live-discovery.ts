import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from '../config.js';
import {createDb,closeDb} from '../db/client.js';
import {migrate} from '../db/migrate.js';
import {discoveryHandler} from '../jobs/handlers/discovery-handler.js';
import {crawlHandler} from '../jobs/handlers/crawl-handler.js';
import {researchHandler} from '../jobs/handlers/research-handler.js';
import {qualifyHandler} from '../jobs/handlers/qualify-handler.js';

type ProviderStatus='REAL_API_VALIDATED'|'NOT_CONFIGURED'|'ERROR'|'NOT_RUN';
const config=loadConfig();
const args=process.argv.slice(2);
function arg(name:string, fallback:string){const index=args.indexOf(name);return index>=0&&args[index+1]?args[index+1]:fallback}
const query=arg('--query','empresas con distribución propia en AMBA');
const maxSearches=Math.min(10,Math.max(1,Number(arg('--max-searches','5'))||5));
const maxCompanies=Math.min(10,Math.max(1,Number(arg('--max-companies','5'))||5));
const timestamp=new Date().toISOString().replace(/[:.]/g,'-');

function statusForKey(key?:string):ProviderStatus{return key?.trim()?'NOT_RUN':'NOT_CONFIGURED'}
function md(value:unknown){return String(value??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ')}
function json(value:unknown){return JSON.stringify(value,null,2)}

async function main(){
  if(config.OUTREACH_ENABLED)throw new Error('OUTREACH_ENABLED_MUST_BE_FALSE');
  const report:any={objective:{query,location:config.BASE_LOCATION,maxSearchRequests:maxSearches,maxCompanies},providers:{Brave:statusForKey(config.BRAVE_SEARCH_API_KEY),'Google Places':statusForKey(config.GOOGLE_MAPS_API_KEY),OpenAI:statusForKey(config.OPENAI_API_KEY)},metrics:{searchRequests:0,rawResults:0,classifiedTypes:{},entityCandidates:0,companiesCreated:0,companiesMerged:0,companiesCrawled:0,contactsFound:0,companiesResearchedWithAI:0},rawResults:[],realLeads:[],badResults:[],errors:[]};
  if(!config.BRAVE_SEARCH_API_KEY&&!config.GOOGLE_MAPS_API_KEY){report.errors.push('NO_DISCOVERY_PROVIDER_CONFIGURED');return await writeReport(report)}
  const client=createDb(config);
  try{
    await migrate(client.pool);
    const before=(await client.pool.query<{id:string}>('SELECT id FROM companies')).rows.map(row=>row.id);
    const jobId=`live-discovery-${Date.now()}`;
    await discoveryHandler(client.db,{...config,DISCOVERY_MAX_SEARCH_REQUESTS:maxSearches,DISCOVERY_MAX_NEW_COMPANIES:maxCompanies},{id:jobId,payload:{query}},{});
    const run=(await client.pool.query<{id:string}>('SELECT id FROM runs WHERE type=$1 ORDER BY started_at DESC LIMIT 1',['DISCOVERY'])).rows[0];
    if(!run)throw new Error('LIVE_RUN_NOT_FOUND');
    const raw=(await client.pool.query<any>('SELECT id,provider,query,result_url,title,description,classification,classification_confidence FROM raw_search_results WHERE run_id=$1 ORDER BY created_at',[run.id])).rows;
    report.metrics.searchRequests=(await client.pool.query<{count:string}>('SELECT count(*) FROM provider_executions WHERE run_id=$1',[run.id])).rows[0]?.count??'0';
    report.metrics.rawResults=raw.length;
    for(const row of raw){report.metrics.classifiedTypes[row.classification]=(report.metrics.classifiedTypes[row.classification]??0)+1;report.rawResults.push({title:row.title,url:row.result_url,type:row.classification,confidence:row.classification_confidence,snippet:row.description??'',reason:row.classification==='COMPANY_WEBSITE'?'candidate corporate result':'not converted into Company'});if(row.classification!=='COMPANY_WEBSITE'&&row.classification!=='SOCIAL_PROFILE')report.badResults.push({title:row.title,url:row.result_url,type:row.classification,reason:'filtered before company creation'})}
    const companies=(await client.pool.query<any>(`SELECT DISTINCT c.id,c.name,c.domain,c.address,c.website,c.google_place_id FROM companies c JOIN sources s ON s.company_id=c.id WHERE s.metadata->>'rawResultId' IN (SELECT id::text FROM raw_search_results WHERE run_id=$1) ORDER BY c.created_at LIMIT $2`,[run.id,maxCompanies])).rows;
    report.metrics.entityCandidates=Number((await client.pool.query<{count:string}>('SELECT count(*) FROM entity_candidates ec JOIN raw_search_results r ON r.id=ec.raw_result_id WHERE r.run_id=$1',[run.id])).rows[0]?.count??0);
    report.metrics.companiesCreated=companies.filter(row=>!before.includes(row.id)).length;report.metrics.companiesMerged=Math.max(0,companies.length-report.metrics.companiesCreated);
    for(const company of companies){
      let crawled=false;let researched=false;
      if(company.website){try{await crawlHandler(client.db,config,{id:`${jobId}:crawl:${company.id}`,payload:{companyId:company.id,website:company.website}},{});crawled=true}catch(error){report.errors.push(`CRAWL ${company.name}: ${error instanceof Error?error.message:String(error)}`)}}
      if(config.OPENAI_API_KEY){try{await researchHandler(client.db,config,{id:`${jobId}:research:${company.id}`,payload:{companyId:company.id}},{});researched=true}catch(error){report.errors.push(`RESEARCH ${company.name}: ${error instanceof Error?error.message:String(error)}`)}}
      if(researched){try{await qualifyHandler(client.db,config,{id:`${jobId}:qualify:${company.id}`,payload:{companyId:company.id}},{});}catch(error){report.errors.push(`QUALIFY ${company.name}: ${error instanceof Error?error.message:String(error)}`)}}
      if(crawled)report.metrics.companiesCrawled++;
      if(researched)report.metrics.companiesResearchedWithAI++;
      const contacts=(await client.pool.query<any>('SELECT email,phone,source_url,verification_status FROM contacts WHERE company_id=$1 ORDER BY email NULLS LAST,phone NULLS LAST',[company.id])).rows;
      const evidence=(await client.pool.query<any>('SELECT id,excerpt,source_url,signal_type,confidence FROM evidence WHERE company_id=$1 ORDER BY observed_at DESC',[company.id])).rows;
      const research=(await client.pool.query<any>('SELECT summary,confidence,use_case,refrigeration_fit,transport_fit_signals,recurrence_signals,buying_signals FROM research_results WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1',[company.id])).rows[0];
      const qualification=(await client.pool.query<any>('SELECT transport_need,vehicle_fit,geography,recurrence,contact_quality,recency,transport_fit,total,use_case,refrigeration_fit,confidence,reasoning FROM qualifications WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1',[company.id])).rows[0];
      report.metrics.contactsFound+=contacts.length;
      const fit=qualification?.transport_fit??qualification?.total??null;const commercialFit=fit===null?'LOW':fit>=70?'HIGH':fit>=45?'MEDIUM':'LOW';
      report.realLeads.push({company:company.name,website:company.website,location:company.address,placeId:company.google_place_id,transportFit:fit,useCase:qualification?.use_case??research?.use_case??'UNKNOWN',refrigerationFit:qualification?.refrigeration_fit??research?.refrigeration_fit??'UNKNOWN',confidence:qualification?.confidence??'UNQUALIFIED',commercialFit,contact:contacts,why:research?.summary??'Sin research de OpenAI',evidence:evidence.map(item=>({id:item.id,excerpt:item.excerpt,signalType:item.signal_type,confidence:item.confidence,url:item.source_url})),sources:[...new Set(evidence.map(item=>item.source_url))]});
    }
    report.providers.Brave=config.BRAVE_SEARCH_API_KEY?'REAL_API_VALIDATED':'NOT_CONFIGURED';report.providers['Google Places']=config.GOOGLE_MAPS_API_KEY?'REAL_API_VALIDATED':'NOT_CONFIGURED';report.providers.OpenAI=config.OPENAI_API_KEY?(report.metrics.companiesResearchedWithAI?'REAL_API_VALIDATED':'ERROR'):'NOT_CONFIGURED';
  }finally{await closeDb(client)}
  await writeReport(report);
}

async function writeReport(report:any){
  const jsonPath=path.resolve('reports',`live-discovery-${timestamp}.json`);const mdPath=path.resolve('reports',`live-discovery-${timestamp}.md`);await fs.mkdir(path.dirname(jsonPath),{recursive:true});await fs.writeFile(jsonPath,json(report),'utf8');
  const lines=[`# Live Discovery`,``,`Objective: ${md(report.objective.query)} — ${md(report.objective.location)}`,``,`## Providers`,``,`- Brave: ${report.providers.Brave}`,`- Google Places: ${report.providers['Google Places']}`,`- OpenAI: ${report.providers.OpenAI}`,``,`## Metrics`,``,`- Search requests: ${report.metrics.searchRequests}`,`- Raw results: ${report.metrics.rawResults}`,`- Entity candidates: ${report.metrics.entityCandidates}`,`- Companies created: ${report.metrics.companiesCreated}`,`- Companies merged: ${report.metrics.companiesMerged}`,`- Companies crawled: ${report.metrics.companiesCrawled}`,`- Contacts found: ${report.metrics.contactsFound}`,`- Companies researched with AI: ${report.metrics.companiesResearchedWithAI}`,``,`Classified types: ${md(report.metrics.classifiedTypes)}`,''];
  report.rawResults.slice(0,10).forEach((item:any,index:number)=>lines.push(`${index+1}. **${md(item.title)}** — ${item.type} — ${md(item.url)}`,`   ${md(item.snippet)}`,'   '));
  lines.push('## Real leads','');for(const lead of report.realLeads.slice(0,10)){lines.push(`### ${md(lead.company)}`,`- Website: ${md(lead.website)}`,`- Location: ${md(lead.location)}`,`- Transport fit: ${lead.transportFit??'unqualified'}/100`,`- Use case: ${lead.useCase}`,`- Refrigeration fit: ${lead.refrigerationFit}`,`- Commercial fit: ${lead.commercialFit}`,`- Contact: ${md(lead.contact.map((item:any)=>item.email??item.phone).filter(Boolean).join(', '))}`,`- Why: ${md(lead.why)}`,'- Evidence:',...lead.evidence.slice(0,5).map((item:any)=>`  - ${md(item.url)} — ${md(item.excerpt)}`),'')}
  lines.push('## Bad results','',...report.badResults.slice(0,10).map((item:any)=>`- ${item.type}: ${md(item.title)} — ${md(item.url)} (${item.reason})`),'','## Errors','',...report.errors.map((item:string)=>`- ${md(item)}`));await fs.writeFile(mdPath,lines.join('\n'),'utf8');console.log(JSON.stringify({json:jsonPath,markdown:mdPath,providers:report.providers,metrics:report.metrics},null,2));
}
main().catch(error=>{console.error(JSON.stringify({status:'ERROR',error:error instanceof Error?error.message:String(error)}));process.exitCode=1});
