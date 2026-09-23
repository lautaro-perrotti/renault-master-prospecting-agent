import {classifyScore,type RefrigerationFit,type ScoreBreakdown,type UseCase} from '../domain.js';

export type ScoringEvidence={id:string;excerpt:string;signalType:string;observedAt:Date|string;confidence:number};
export type ResearchHints={useCase?:UseCase;refrigerationFit?:RefrigerationFit;transportFitSignals?:Array<{evidenceId:string;signal:string}>;recurrenceSignals?:Array<{evidenceId:string;signal:string}>;buyingSignals?:Array<{evidenceId:string;signal:string}>};

const cold=/refriger|congel|cadena\s+de\s+fr|ultracongel|helad|lacte|frozen/i;
const transport=/distribu|entrega|repart|logist|abastec|reposici|fleter|transport|recorrid|mercader|mayorista|horeca|comercio/i;
const recurrent=/diari|semanal|periodic|frecuent|recurrent|recorrid|todos los dias|mensual/i;
const directNeed=/buscamos fleter|vehiculo propio|contratamos transport|terceriz|proveedor logist|necesitamos repart/i;
const geographyPattern=/caba|gba|gran buenos|am[bm]a|buenos aires|zona norte|zona oeste|zona sur/i;
const dry=/secos?|mercader.*a (general|seca)|no refriger|marketing digital|consultor/i;

function textOf(evidence:ScoringEvidence[]){return evidence.map(item=>`${item.signalType} ${item.excerpt}`).join(' ')}
function ids(evidence:ScoringEvidence[],pattern:RegExp){return evidence.filter(item=>pattern.test(`${item.signalType} ${item.excerpt}`)).map(item=>item.id)}

export function inferUseCase(text:string,hints?:ResearchHints):UseCase{
  if(hints?.useCase)return hints.useCase;
  const hasCold=cold.test(text);const hasDry=dry.test(text);const hasTransport=transport.test(text);
  if(hasCold&&hasDry)return'MIXED';
  if(hasCold)return'REFRIGERATED';
  if(hasTransport)return'NON_REFRIGERATED';
  return'UNKNOWN';
}

export function inferRefrigerationFit(text:string,hints?:ResearchHints):RefrigerationFit{
  if(hints?.refrigerationFit)return hints.refrigerationFit;
  if(/congel|cadena\s+de\s+fr|ultracongel|frozen/i.test(text))return'REQUIRED';
  if(/refriger|helad|lacte/i.test(text))return'STRONG_ADVANTAGE';
  if(/alimento|gastron|fruta|verdura/i.test(text))return'OPTIONAL_ADVANTAGE';
  if(dry.test(text))return'NOT_REQUIRED';
  return'UNKNOWN';
}

export function scoreTransportOpportunity(input:{evidence?:ScoringEvidence[];address?:string;contact:boolean;recent?:boolean;research?:ResearchHints}):ScoreBreakdown{
  const evidence=input.evidence??[];const text=`${textOf(evidence)} ${input.address??''}`;
  const transportIds=ids(evidence,transport);const directIds=ids(evidence,directNeed);const geographyIds=ids(evidence,geographyPattern);const recurrenceIds=ids(evidence,recurrent);const coldIds=ids(evidence,cold);
  const transportNeed=transportIds.length?Math.min(30,directIds.length?30:transportIds.length>=2?25:18):0;
  const vehicleFit=directIds.length?25:transportIds.length?18:0;
  const geography=geographyPattern.test(text)?15:0;
  const recurrence=recurrenceIds.length?15:0;
  const contactQuality=input.contact?10:0;
  const dates=evidence.map(item=>new Date(item.observedAt).getTime()).filter(Number.isFinite);const latest=dates.length?Math.max(...dates):0;const ageDays=latest?Math.max(0,(Date.now()-latest)/86_400_000):Infinity;const recency=input.recent===true||ageDays<=90?5:0;
  const useCase=inferUseCase(text,input.research);const refrigerationFit=inferRefrigerationFit(text,input.research);const confidence=evidence.length>=3&&evidence.every(item=>item.confidence>=70)?'HIGH':evidence.length?'MEDIUM':'LOW';
  const reasoning={transportNeed:transportIds,vehicleFit:directIds.length?directIds:transportIds,geography:geographyIds,recurrence:recurrenceIds,contact:input.contact?['verified-contact']:[],recency:recency?evidence.filter(item=>new Date(item.observedAt).getTime()===latest).map(item=>item.id):[],refrigeration:coldIds};
  const transportFit=transportNeed+vehicleFit+geography+recurrence+contactQuality+recency;
  return{fit:vehicleFit,need:transportNeed,geography,contactQuality,recency,total:transportFit,confidence,transportNeed,vehicleFit,recurrence,transportFit,useCase,refrigerationFit,reasoning};
}

export function scoreCompany(input:{evidence?:ScoringEvidence[];signals?:string[];address?:string;contact:boolean;recent?:boolean;research?:ResearchHints}){
  const evidence=input.evidence??(input.signals??[]).map((excerpt,index)=>({id:`legacy-${index}`,excerpt,signalType:'OTHER',observedAt:new Date(),confidence:50}));
  return scoreTransportOpportunity({...input,evidence});
}
export {classifyScore};
export type {ScoreBreakdown};
