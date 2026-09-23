import {sql} from 'drizzle-orm';
import type {Config} from '../../config.js';
import type {Db} from '../../db/client.js';
import {audit} from '../../audit.js';
import {OpenAIResearchProvider,type ResearchProvider,type ResearchResult,validateResearchResult} from '../../qualification/ai-research.js';
import type {JobDependencies} from '../dependencies.js';
import {enqueue} from '../queue.js';

function fallback(input:{company:string;evidence:{id:string;excerpt:string}[]}):ResearchResult{const text=input.evidence.map(x=>x.excerpt).join(' ').toLowerCase();const signals=input.evidence.filter(x=>/refriger|congel|distribu|entrega|log[ií]st|mayorista|horeca/.test(x.excerpt.toLowerCase())).map(x=>({evidenceId:x.id,signal:'observed_business_signal'}));return{companyType:/distribu|mayorista/.test(text)?'DISTRIBUTOR':'UNKNOWN',relevance:signals.length?0.8:0.2,summary:'Clasificación determinista por evidencia pública persistida.',detectedSignals:signals,reasoningSummary:'No hay credencial de IA configurada; se conservan solo señales observables.',recommendedAction:signals.length?'REVIEW':'DISCARD',confidence:signals.length?'MEDIUM':'LOW',businessModel:'unknown',distributionModel:/distribu|entrega|log[ií]st/.test(text)?'distribution':'unknown',geography:'CABA/GBA pendiente de confirmar',potentialTransportNeed:signals.length?'possible refrigerated transport need':'unknown',uncertainties:['AI provider not configured']}}
export async function researchHandler(db:Db,config:Config,job:any,deps:JobDependencies){
  const companyId=String(job.payload.companyId);const company=(await db.execute(sql`SELECT name FROM companies WHERE id=${companyId}`)).rows[0] as any;if(!company)throw new Error('COMPANY_NOT_FOUND');
  const evidence=(await db.execute(sql`SELECT id,excerpt FROM evidence WHERE company_id=${companyId} ORDER BY observed_at DESC LIMIT 30`)).rows as any[];if(!evidence.length)throw new Error('RESEARCH_REQUIRES_EVIDENCE');
  let provider:ResearchProvider=deps.research??(config.OPENAI_API_KEY?new OpenAIResearchProvider(config):{research:async(input)=>fallback(input)});
  const result=validateResearchResult(await provider.research({company:company.name,evidence:evidence.map(item=>({id:String(item.id),excerpt:String(item.excerpt)}))}),evidence.map(item=>String(item.id)));
  await db.execute(sql`INSERT INTO research_results(company_id,model,business_model,refrigeration_relevance,distribution_model,geography,potential_transport_need,signals,uncertainties,summary,confidence) VALUES(${companyId},${config.OPENAI_API_KEY?'openai':'deterministic-fallback'},${result.businessModel??result.companyType},${Math.round(result.relevance*100)},${result.distributionModel??'unknown'},${result.geography??'unknown'},${result.potentialTransportNeed??'unknown'},${JSON.stringify(result.detectedSignals)}::jsonb,${JSON.stringify(result.uncertainties??[])}::jsonb,${result.summary},${result.confidence==='HIGH'?90:result.confidence==='MEDIUM'?65:35})`);
  await audit(db,'RESEARCH_COMPLETED',{model:config.OPENAI_API_KEY?'openai':'deterministic-fallback',evidenceIds:evidence.map(item=>item.id),detectedSignals:result.detectedSignals},companyId,job.id);
  await enqueue(db,'QUALIFY',{companyId},new Date(),{idempotencyKey:`QUALIFY:${companyId}`});
}
