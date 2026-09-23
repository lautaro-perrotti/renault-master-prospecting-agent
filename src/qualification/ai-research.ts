import OpenAI from 'openai';
import {z} from 'zod';
import {RefrigerationFit,UseCase} from '../domain.js';
import type {Config} from '../config.js';

const EvidenceSignal=z.object({evidenceId:z.string().min(1),signal:z.string().min(1)});
const Result=z.object({
  companyType:z.string(),businessModel:z.string().default('unknown'),movesPhysicalGoods:z.union([z.boolean(),z.literal('unknown')]).optional(),transportOperation:z.string().optional(),
  transportFitSignals:z.array(EvidenceSignal).optional(),useCase:UseCase.optional(),refrigerationFit:RefrigerationFit.optional(),geography:z.string().default('unknown'),recurrenceSignals:z.array(EvidenceSignal).optional(),buyingSignals:z.array(EvidenceSignal).optional(),contactAssessment:z.string().optional(),uncertainties:z.array(z.string()).default([]),summary:z.string(),confidence:z.enum(['HIGH','MEDIUM','LOW']),evidenceIds:z.array(z.string()).optional(),
  relevance:z.number().min(0).max(1).default(0),detectedSignals:z.array(EvidenceSignal).default([]),reasoningSummary:z.string().default(''),recommendedAction:z.enum(['REVIEW','CONTACT','DISCARD']).default('REVIEW'),distributionModel:z.string().default('unknown'),potentialTransportNeed:z.string().default('unknown')
});
export type ResearchResult=z.infer<typeof Result>;
export type ResearchInput={company:string;evidence:{id:string;excerpt:string}[]};

export function validateResearchResult(result:ResearchResult,evidenceIds:string[]){
  const allowed=new Set(evidenceIds);const references=[...(result.evidenceIds??[]),...result.detectedSignals.map(signal=>signal.evidenceId),...(result.transportFitSignals??[]).map(signal=>signal.evidenceId),...(result.recurrenceSignals??[]).map(signal=>signal.evidenceId),...(result.buyingSignals??[]).map(signal=>signal.evidenceId)];
  if(references.some(id=>!allowed.has(id)))throw new Error('AI_REFERENCES_UNKNOWN_EVIDENCE');
  Result.parse(result);return result;
}

const signalSchema={type:'object',properties:{evidenceId:{type:'string'},signal:{type:'string'}},required:['evidenceId','signal'],additionalProperties:false};
const responseSchema={type:'object',properties:{companyType:{type:'string'},businessModel:{type:'string'},movesPhysicalGoods:{anyOf:[{type:'boolean'},{type:'string',enum:['unknown']}]},transportOperation:{type:'string'},transportFitSignals:{type:'array',items:signalSchema},useCase:{type:'string',enum:UseCase.options},refrigerationFit:{type:'string',enum:RefrigerationFit.options},geography:{type:'string'},recurrenceSignals:{type:'array',items:signalSchema},buyingSignals:{type:'array',items:signalSchema},contactAssessment:{type:'string'},uncertainties:{type:'array',items:{type:'string'}},summary:{type:'string'},confidence:{type:'string',enum:['HIGH','MEDIUM','LOW']},evidenceIds:{type:'array',items:{type:'string'}},relevance:{type:'number'},detectedSignals:{type:'array',items:signalSchema},reasoningSummary:{type:'string'},recommendedAction:{type:'string',enum:['REVIEW','CONTACT','DISCARD']},distributionModel:{type:'string'},potentialTransportNeed:{type:'string'}},required:['companyType','businessModel','movesPhysicalGoods','transportOperation','transportFitSignals','useCase','refrigerationFit','geography','recurrenceSignals','buyingSignals','contactAssessment','uncertainties','summary','confidence','evidenceIds','relevance','detectedSignals','reasoningSummary','recommendedAction','distributionModel','potentialTransportNeed'],additionalProperties:false};

export interface ResearchProvider{research(input:ResearchInput):Promise<ResearchResult>}
export class OpenAIResearchProvider implements ResearchProvider{
  private client:OpenAI;
  constructor(private config:Config){if(!config.OPENAI_API_KEY)throw new Error('NOT_CONFIGURED: OPENAI_API_KEY');this.client=new OpenAI({apiKey:config.OPENAI_API_KEY})}
  async research(input:ResearchInput){
    const response=await this.client.responses.create({model:'gpt-4o-mini',input:`Analiza ${input.company} para transporte compatible con una Renault Master. La refrigeraci\u00f3n es una capacidad adicional, no un requisito general. Usa exclusivamente esta evidencia p\u00fablica y referencia sus IDs: ${JSON.stringify(input.evidence)}`,text:{format:{type:'json_schema',name:'transport_research',strict:true,schema:responseSchema}}});
    return validateResearchResult(Result.parse(JSON.parse(response.output_text)),input.evidence.map(item=>item.id));
  }
}
export async function researchWithAI(config:Config,input:ResearchInput){return new OpenAIResearchProvider(config).research(input)}
