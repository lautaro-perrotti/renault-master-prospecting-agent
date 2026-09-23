import OpenAI from 'openai';
import {z} from 'zod';
import {RefrigerationFit,UseCase} from '../domain.js';
import type {Config} from '../config.js';

const EvidenceSignal=z.object({evidenceId:z.string().min(1),signal:z.string().min(1)});
const Result=z.object({
  companyType:z.string(),businessModel:z.string().default('unknown'),movesPhysicalGoods:z.union([z.boolean(),z.literal('unknown')]).optional(),transportOperation:z.string().optional(),
  transportFitSignals:z.array(EvidenceSignal).optional(),useCase:UseCase.optional(),refrigerationFit:RefrigerationFit.optional(),geography:z.string().default('unknown'),recurrenceSignals:z.array(EvidenceSignal).optional(),buyingSignals:z.array(EvidenceSignal).optional(),contactAssessment:z.string().optional(),uncertainties:z.array(z.string()).default([]),summary:z.string(),confidence:z.enum(['HIGH','MEDIUM','LOW']),evidenceIds:z.array(z.string()).optional(),
  relevance:z.number().min(0).max(100).transform(value=>value>1?value/100:value).default(0),detectedSignals:z.array(EvidenceSignal).default([]),reasoningSummary:z.string().default(''),recommendedAction:z.enum(['REVIEW','CONTACT','DISCARD']).default('REVIEW'),distributionModel:z.string().default('unknown'),potentialTransportNeed:z.string().default('unknown'),modelUsed:z.string().optional(),escalated:z.boolean().optional(),escalationReason:z.string().optional(),usage:z.record(z.string(),z.unknown()).optional()
});
export type ResearchResult=z.infer<typeof Result>;
export type ResearchInput={company:string;sources?:Array<{url:string;sourceType?:string}>;evidence:{id:string;excerpt:string}[];contacts?:Array<{email?:string;phone?:string;sourceUrl?:string;verificationStatus?:string}>};

export function validateResearchResult(result:ResearchResult,evidenceIds:string[]){
  const parsed=Result.parse(result);const allowed=new Set(evidenceIds);const references=[...(parsed.evidenceIds??[]),...parsed.detectedSignals.map(signal=>signal.evidenceId),...(parsed.transportFitSignals??[]).map(signal=>signal.evidenceId),...(parsed.recurrenceSignals??[]).map(signal=>signal.evidenceId),...(parsed.buyingSignals??[]).map(signal=>signal.evidenceId)];
  if(references.some(id=>!allowed.has(id)))throw new Error('AI_INVALID_EVIDENCE_REFERENCE');
  return parsed;
}

const signalSchema={type:'object',properties:{evidenceId:{type:'string'},signal:{type:'string'}},required:['evidenceId','signal'],additionalProperties:false};
const responseSchema={type:'object',properties:{companyType:{type:'string'},businessModel:{type:'string'},movesPhysicalGoods:{anyOf:[{type:'boolean'},{type:'string',enum:['unknown']}]},transportOperation:{type:'string'},transportFitSignals:{type:'array',items:signalSchema},useCase:{type:'string',enum:UseCase.options},refrigerationFit:{type:'string',enum:RefrigerationFit.options},geography:{type:'string'},recurrenceSignals:{type:'array',items:signalSchema},buyingSignals:{type:'array',items:signalSchema},contactAssessment:{type:'string'},uncertainties:{type:'array',items:{type:'string'}},summary:{type:'string'},confidence:{type:'string',enum:['HIGH','MEDIUM','LOW']},evidenceIds:{type:'array',items:{type:'string'}},relevance:{type:'number'},detectedSignals:{type:'array',items:signalSchema},reasoningSummary:{type:'string'},recommendedAction:{type:'string',enum:['REVIEW','CONTACT','DISCARD']},distributionModel:{type:'string'},potentialTransportNeed:{type:'string'}},required:['companyType','businessModel','movesPhysicalGoods','transportOperation','transportFitSignals','useCase','refrigerationFit','geography','recurrenceSignals','buyingSignals','contactAssessment','uncertainties','summary','confidence','evidenceIds','relevance','detectedSignals','reasoningSummary','recommendedAction','distributionModel','potentialTransportNeed'],additionalProperties:false};

export interface ResearchProvider{research(input:ResearchInput):Promise<ResearchResult>}
function escalationReason(result:ResearchResult,config:Config){
  const confidenceScore=result.confidence==='HIGH'?90:result.confidence==='MEDIUM'?65:35;
  if(confidenceScore<config.OPENAI_ESCALATION_CONFIDENCE_THRESHOLD)return'LOW_CONFIDENCE';
  if(result.useCase==='UNKNOWN'&&((result.transportFitSignals?.length??0)+(result.recurrenceSignals?.length??0)+(result.buyingSignals?.length??0)>0))return'UNKNOWN_USE_CASE_WITH_COMMERCIAL_SIGNALS';
  if((result.transportFitSignals?.length??0)===1&&((result.recurrenceSignals?.length??0)>0||(result.buyingSignals?.length??0)>0))return'BORDERLINE_TRANSPORT_FIT';
  return undefined;
}

export class OpenAIResearchProvider implements ResearchProvider{
  private client:OpenAI;
  constructor(private config:Config){if(!config.OPENAI_API_KEY)throw new Error('NOT_CONFIGURED: OPENAI_API_KEY');this.client=new OpenAI({apiKey:config.OPENAI_API_KEY})}
  private async request(model:string,input:ResearchInput){
    const response=await this.client.responses.create({model,input:`Analiza ${input.company} para transporte compatible con una Renault Master. La refrigeración es una capacidad adicional, no un requisito general. Usa exclusivamente la evidencia pública entregada y referencia sus IDs. Sources: ${JSON.stringify(input.sources??[])} Contacts: ${JSON.stringify(input.contacts??[])} Evidence: ${JSON.stringify(input.evidence)}`,text:{format:{type:'json_schema',name:'transport_research',strict:true,schema:responseSchema}}});
    const result=validateResearchResult(Result.parse(JSON.parse(response.output_text)),input.evidence.map(item=>item.id));return{...result,usage:response.usage?JSON.parse(JSON.stringify(response.usage)):undefined};
  }
  async research(input:ResearchInput){
    let primary:ResearchResult;
    try{primary=await this.request(this.config.OPENAI_MODEL,input)}catch(error){if(error instanceof Error&&error.message==='AI_INVALID_EVIDENCE_REFERENCE'){const escalated=await this.request(this.config.OPENAI_ESCALATION_MODEL,input);return{...escalated,modelUsed:this.config.OPENAI_ESCALATION_MODEL,escalated:true,escalationReason:'INVALID_EVIDENCE_REFERENCE'}}const escalated=await this.request(this.config.OPENAI_ESCALATION_MODEL,input);return{...escalated,modelUsed:this.config.OPENAI_ESCALATION_MODEL,escalated:true,escalationReason:'INVALID_STRUCTURED_OUTPUT'}}
    const reason=escalationReason(primary,this.config);if(!reason)return{...primary,modelUsed:this.config.OPENAI_MODEL,escalated:false};
    const escalated=await this.request(this.config.OPENAI_ESCALATION_MODEL,input);return{...escalated,modelUsed:this.config.OPENAI_ESCALATION_MODEL,escalated:true,escalationReason:reason};
  }
}
export async function researchWithAI(config:Config,input:ResearchInput){return new OpenAIResearchProvider(config).research(input)}
