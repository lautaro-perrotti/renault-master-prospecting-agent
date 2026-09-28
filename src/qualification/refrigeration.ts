import type {RefrigerationFit,UseCase} from '../domain.js';

export type RefrigerationSegment='REFRIGERATED'|'NON_REFRIGERATED'|'UNKNOWN';

export function classifyRefrigeration(useCase?:string|null,refrigerationFit?:string|null):RefrigerationSegment{
  if(useCase==='NON_REFRIGERATED'||refrigerationFit==='NOT_REQUIRED')return'NON_REFRIGERATED';
  if(useCase==='MIXED')return'UNKNOWN';
  if(useCase==='REFRIGERATED'||refrigerationFit==='REQUIRED')return'REFRIGERATED';
  return'UNKNOWN';
}

export function classifyPersistedRefrigeration(input:{useCase?:UseCase|string|null;refrigerationFit?:RefrigerationFit|string|null;fallbackUseCase?:UseCase|string|null;fallbackRefrigerationFit?:RefrigerationFit|string|null}):RefrigerationSegment{
  const direct=classifyRefrigeration(input.useCase,input.refrigerationFit);
  if(input.useCase==='MIXED'&&input.refrigerationFit!=='NOT_REQUIRED')return'UNKNOWN';
  if(direct!=='UNKNOWN')return direct;
  return classifyRefrigeration(input.fallbackUseCase,input.fallbackRefrigerationFit);
}
