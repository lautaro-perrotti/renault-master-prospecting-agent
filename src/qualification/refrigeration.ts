import type {RefrigerationFit,UseCase} from '../domain.js';

export type RefrigerationSegment='REFRIGERATED'|'NON_REFRIGERATED'|'UNKNOWN';

export function classifyRefrigeration(useCase?:string|null,refrigerationFit?:string|null):RefrigerationSegment{
  if(useCase==='REFRIGERATED'||useCase==='MIXED'||refrigerationFit==='REQUIRED'||refrigerationFit==='STRONG_ADVANTAGE')return'REFRIGERATED';
  if(useCase==='NON_REFRIGERATED'||refrigerationFit==='NOT_REQUIRED')return'NON_REFRIGERATED';
  return'UNKNOWN';
}

export function classifyPersistedRefrigeration(input:{useCase?:UseCase|string|null;refrigerationFit?:RefrigerationFit|string|null;fallbackUseCase?:UseCase|string|null;fallbackRefrigerationFit?:RefrigerationFit|string|null}):RefrigerationSegment{
  const direct=classifyRefrigeration(input.useCase,input.refrigerationFit);
  if(direct!=='UNKNOWN')return direct;
  return classifyRefrigeration(input.fallbackUseCase,input.fallbackRefrigerationFit);
}
