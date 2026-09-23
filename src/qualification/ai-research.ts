import OpenAI from 'openai';
import {z} from 'zod';
import type {Config} from '../config.js';

const Result=z.object({
  companyType:z.string(),relevance:z.number().min(0).max(1),summary:z.string(),
  detectedSignals:z.array(z.object({evidenceId:z.string(),signal:z.string()})),
  reasoningSummary:z.string(),recommendedAction:z.enum(['REVIEW','CONTACT','DISCARD']),confidence:z.enum(['HIGH','MEDIUM','LOW']),
  businessModel:z.string().default('unknown'),distributionModel:z.string().default('unknown'),geography:z.string().default('unknown'),potentialTransportNeed:z.string().default('unknown'),uncertainties:z.array(z.string()).default([])
});
export type ResearchResult=z.infer<typeof Result>;
export type ResearchInput={company:string;evidence:{id:string;excerpt:string}[]};
export interface ResearchProvider{research(input:ResearchInput):Promise<ResearchResult>}

export function validateResearchResult(result:ResearchResult,evidenceIds:string[]){
  const allowed=new Set(evidenceIds);
  if(result.detectedSignals.some(signal=>!allowed.has(signal.evidenceId)))throw new Error('AI_REFERENCES_UNKNOWN_EVIDENCE');
  Result.parse(result);
  return result;
}

export class OpenAIResearchProvider implements ResearchProvider{
  private client:OpenAI;
  constructor(private config:Config){if(!config.OPENAI_API_KEY)throw new Error('NOT_CONFIGURED: OPENAI_API_KEY');this.client=new OpenAI({apiKey:config.OPENAI_API_KEY})}
  async research(input:ResearchInput){
    const response=await this.client.responses.create({model:'gpt-4o-mini',input:`Analiza la empresa ${input.company}. Usa exclusivamente esta evidencia pública: ${JSON.stringify(input.evidence)}`,text:{format:{type:'json_schema',name:'research',strict:true,schema:{type:'object',properties:{companyType:{type:'string'},relevance:{type:'number'},summary:{type:'string'},detectedSignals:{type:'array',items:{type:'object',properties:{evidenceId:{type:'string'},signal:{type:'string'}},required:['evidenceId','signal'],additionalProperties:false}},reasoningSummary:{type:'string'},recommendedAction:{type:'string',enum:['REVIEW','CONTACT','DISCARD']},confidence:{type:'string',enum:['HIGH','MEDIUM','LOW']},businessModel:{type:'string'},distributionModel:{type:'string'},geography:{type:'string'},potentialTransportNeed:{type:'string'},uncertainties:{type:'array',items:{type:'string'}}},required:['companyType','relevance','summary','detectedSignals','reasoningSummary','recommendedAction','confidence','businessModel','distributionModel','geography','potentialTransportNeed','uncertainties'],additionalProperties:false}}}});
    return validateResearchResult(Result.parse(JSON.parse(response.output_text)),input.evidence.map(e=>e.id));
  }
}

export async function researchWithAI(config:Config,input:ResearchInput){return new OpenAIResearchProvider(config).research(input)}
