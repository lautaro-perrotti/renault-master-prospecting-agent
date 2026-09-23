import {BusinessRole,ContactRole,FleetStatus,OutsourcingSignal,TransportDemandRole,classifyScore,type RefrigerationFit,type ScoreBreakdown,type UseCase} from '../domain.js';

export type ScoringEvidence={id:string;excerpt:string;signalType:string;observedAt:Date|string;confidence:number};
export type EvidenceSignal={evidenceId:string;signal:string};
export type ResearchHints={useCase?:UseCase;refrigerationFit?:RefrigerationFit;transportFitSignals?:EvidenceSignal[];recurrenceSignals?:EvidenceSignal[];buyingSignals?:EvidenceSignal[];outsourcingSignals?:EvidenceSignal[];businessRole?:BusinessRole;transportDemandRole?:TransportDemandRole;hasOwnFleet?:FleetStatus;outsourcesTransport?:FleetStatus;movesPhysicalGoods?:boolean|'unknown';contactAssessment?:string};

const cold=/refriger|congel|cadena\s+de\s+fr|ultracongel|helad|lacte|frozen/i;
const transport=/distribu|entrega|repart|logist|abastec|reposici|fleter|transport|recorrid|mercader|mayorista|horeca|comercio|paqueter|ultima milla|last mile/i;
const recurrent=/diari|semanal|periodic|frecuent|recurrent|recorrid|todos los dias|mensual|same.?day|next.?day/i;
const directNeed=/buscamos\s+(fleter|transport|chofer)|vehiculo propio|contratamos transport|terceriz|proveedor(?:es)? de transporte|necesitamos repart|sumamos transport|delivery partner|partner de entrega/i;
const geographyPattern=/caba|gba|gran buenos|am[bm]a|buenos aires|zona norte|zona oeste|zona sur/i;
const dry=/secos?|mercader.*a (general|seca)|no refriger|marketing digital|consultor/i;
const physicalGoods=/producto|mercader|alimento|insumo|bebida|carga|pedido|paquete|stock|dep[oó]sito|venta/i;
const compatibleVehicle=/utilitario|camioneta|furg[oó]n|carga parcial|carga liviana|ultima milla|last mile|same.?day|entrega domiciliaria|reparto urbano/i;
const outsourcingPatterns:Record<OutsourcingSignal,RegExp>={LOOKING_FOR_CARRIERS:/buscamos.*(transport|carrier)|proveedor(?:es)? de transporte|contrat.*transport/i,LOOKING_FOR_FLETEROS:/buscamos.*fleter|se busca fleter|sumamos.*fleter/i,SUBCONTRACTED_TRANSPORT:/terceriz|subcontrat|transporte tercerizado/i,THIRD_PARTY_FLEET:/flota externa|fleet externa|proveedor externo/i,EXTERNAL_DRIVERS:/chofer(?:es)? con veh[ií]culo|conductores externos|external drivers/i,DELIVERY_PARTNERS:/delivery partners?|socios? de entrega|partner(?:s)? de entrega/i,OVERFLOW_CAPACITY:/overflow|pico(?:s)? de demanda|refuerzo de capacidad|capacidad adicional/i,SEASONAL_TRANSPORT_NEED:/temporada|estacional|alta demanda|fin de a[nñ]o|navidad/i,ROUTE_EXPANSION:/expansi[oó]n de rutas?|nuevas rutas?|ampliamos cobertura/i,NEW_BRANCH:/nueva sucursal|nuevas sucursales|abrimos.*sucursal/i,NEW_DELIVERY_ZONE:/nuevas zonas? de entrega|nueva zona de reparto|entregas en nuevas/i};

function textOf(evidence:ScoringEvidence[]){return evidence.map(item=>`${item.signalType} ${item.excerpt}`).join(' ')}
function ids(evidence:ScoringEvidence[],pattern:RegExp){return evidence.filter(item=>pattern.test(`${item.signalType} ${item.excerpt}`)).map(item=>item.id)}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value))}
export function legacyVehicleFit(transportOperationFit:number){return Math.round(clamp(transportOperationFit,0,30)*25/30)}
function evidenceSignals(evidence:ScoringEvidence[],patterns:Record<string,RegExp>){return Object.entries(patterns).flatMap(([signal,pattern])=>evidence.filter(item=>pattern.test(`${item.signalType} ${item.excerpt}`)).map(item=>({evidenceId:item.id,signal})))}

export function inferBusinessRole(text:string,hints?:ResearchHints):BusinessRole{
  if(hints?.businessRole)return hints.businessRole;
  if(/courier|paqueter[ií]a|same.?day|last mile|[uú]ltima milla/i.test(text))return'COURIER';
  if(/laborator|farmac[eé]ut|medicamento/i.test(text))return'LABORATORY';
  if(/frigor[ií]fico|cadena de fr[ií]o|cold chain/i.test(text))return'COLD_CHAIN_OPERATOR';
  if(/importador/i.test(text))return'IMPORTER';
  if(/mayorista/i.test(text))return'WHOLESALER';
  if(/distribuidor|distribu[ií]mos|distribuci[oó]n/i.test(text))return'DISTRIBUTOR';
  if(/fabricante|f[aá]brica|manufactur/i.test(text))return'MANUFACTURER';
  if(/gastronom[ií]a|catering|vianda|horeca|restaurante/i.test(text))return'FOOD_SERVICE';
  if(/e.?commerce|tienda online|venta online/i.test(text))return'ECOMMERCE';
  if(/retail|comercio|sucursales|tienda/i.test(text))return'RETAILER';
  if(/transportista|empresa de transporte|flete|log[ií]stica|logistica/i.test(text))return'LOGISTICS_OPERATOR';
  if(physicalGoods.test(text))return'SHIPPER';
  return'UNKNOWN';
}
export function inferHasOwnFleet(text:string,hints?:ResearchHints):FleetStatus{if(hints?.hasOwnFleet)return hints.hasOwnFleet;return /flota propia|veh.{0,3}culo propio|veh[ií]culos propios|unidades propias|camionetas propias|distribuci[oó]n propia/i.test(text)?'YES':'UNKNOWN'}
export function inferTransportDemandRole(text:string,hints?:ResearchHints):TransportDemandRole{if(hints?.transportDemandRole)return hints.transportDemandRole;const role=inferBusinessRole(text,hints);const external=Object.values(outsourcingPatterns).some(pattern=>pattern.test(text));if(external&&['LOGISTICS_OPERATOR','CARRIER','COURIER'].includes(role))return'BOTH';if(['LOGISTICS_OPERATOR','CARRIER','COURIER'].includes(role))return'LIKELY_SELLER';if(['MANUFACTURER','WHOLESALER','DISTRIBUTOR','RETAILER','FOOD_SERVICE','ECOMMERCE','IMPORTER','LABORATORY','SHIPPER'].includes(role))return'LIKELY_BUYER';return external?'POSSIBLE_BUYER':'UNKNOWN'}
export function inferUseCase(text:string,hints?:ResearchHints):UseCase{if(hints?.useCase)return hints.useCase;const hasCold=cold.test(text);const hasDry=dry.test(text);const hasTransport=transport.test(text);if(hasCold&&hasDry)return'MIXED';if(hasCold)return'REFRIGERATED';if(hasTransport)return'NON_REFRIGERATED';return'UNKNOWN'}
export function inferRefrigerationFit(text:string,hints?:ResearchHints):RefrigerationFit{if(hints?.refrigerationFit)return hints.refrigerationFit;if(/congel|cadena\s+de\s+fr|ultracongel|frozen/i.test(text))return'REQUIRED';if(/refriger|helad|lacte/i.test(text))return'STRONG_ADVANTAGE';if(/alimento|gastron|fruta|verdura/i.test(text))return'OPTIONAL_ADVANTAGE';if(dry.test(text))return'NOT_REQUIRED';return'UNKNOWN'}

export function scoreTransportOpportunity(input:{evidence?:ScoringEvidence[];address?:string;contact:boolean;contactRole?:ContactRole;contactKind?:'EMAIL'|'PHONE';recent?:boolean;research?:ResearchHints}):ScoreBreakdown{
  const evidence=input.evidence??[];const text=`${textOf(evidence)} ${input.address??''}`;const hints=input.research;const transportIds=ids(evidence,transport);const directIds=ids(evidence,directNeed);const geographyIds=ids(evidence,geographyPattern);const recurrenceIds=ids(evidence,recurrent);const coldIds=ids(evidence,cold);const physicalIds=ids(evidence,physicalGoods);const compatibleIds=ids(evidence,compatibleVehicle);const role=inferBusinessRole(text,hints);const demandRole=inferTransportDemandRole(text,hints);const ownFleet=inferHasOwnFleet(text,hints);const outsourcingSignals=hints?.outsourcingSignals??evidenceSignals(evidence,outsourcingPatterns);const outsourcingIds=outsourcingSignals.map(item=>item.evidenceId);
  const transportOperationFit=clamp((transportIds.length?12:0)+(physicalIds.length?8:0)+(compatibleIds.length?10:0),0,30);const roleDemand=demandRole==='BOTH'?16:demandRole==='LIKELY_BUYER'?14:demandRole==='POSSIBLE_BUYER'?8:0;const signalDemand=clamp(outsourcingSignals.length*10+(directIds.length?8:0),0,24);const sellerPenalty=(['LOGISTICS_OPERATOR','CARRIER','COURIER'].includes(role)&&!outsourcingSignals.length)?12:0;const ownFleetPenalty=ownFleet==='YES'&&!outsourcingSignals.length?8:0;const externalTransportDemand=clamp(roleDemand+signalDemand-sellerPenalty-ownFleetPenalty,0,30);const geography=geographyPattern.test(text)?15:0;const recurrence=recurrenceIds.length?10:0;const contactQuality=input.contact?(input.contactRole&&['LOGISTICS','OPERATIONS','PURCHASING','SALES','OWNER'].includes(input.contactRole)?10:input.contactKind==='PHONE'?5:8):0;const dates=evidence.map(item=>new Date(item.observedAt).getTime()).filter(Number.isFinite);const latest=dates.length?Math.max(...dates):0;const ageDays=latest?Math.max(0,(Date.now()-latest)/86_400_000):Infinity;const recency=input.recent===true||ageDays<=90?5:0;const useCase=inferUseCase(text,hints);const refrigerationFit=inferRefrigerationFit(text,hints);const confidence=evidence.length>=3&&evidence.every(item=>item.confidence>=70)?'HIGH':evidence.length?'MEDIUM':'LOW';const total=transportOperationFit+externalTransportDemand+geography+recurrence+contactQuality+recency;
  const reasoning={transportOperation:{score:transportOperationFit,max:30,evidence:transportIds,physicalGoods:physicalIds,vehicleCompatibility:compatibleIds},externalTransportDemand:{score:externalTransportDemand,max:30,role,demandRole,ownFleet,outsourcingSignals:outsourcingIds,buyingSignals:directIds,penalties:{sellerPenalty,ownFleetPenalty}},geography:geographyIds,recurrence:recurrenceIds,contact:input.contact?['verified-contact']:[],recency:recency?evidence.filter(item=>new Date(item.observedAt).getTime()===latest).map(item=>item.id):[],refrigeration:coldIds};
  return{fit:transportOperationFit,need:externalTransportDemand,geography,contactQuality,recency,total,confidence,transportNeed:externalTransportDemand,vehicleFit:transportOperationFit,recurrence,transportFit:total,transportOperationFit,externalTransportDemand,useCase,refrigerationFit,reasoning};
}
export function scoreCompany(input:{evidence?:ScoringEvidence[];signals?:string[];address?:string;contact:boolean;contactRole?:ContactRole;contactKind?:'EMAIL'|'PHONE';recent?:boolean;research?:ResearchHints}){const evidence=input.evidence??(input.signals??[]).map((excerpt,index)=>({id:`legacy-${index}`,excerpt,signalType:'OTHER',observedAt:new Date(),confidence:50}));return scoreTransportOpportunity({...input,evidence})}
export {classifyScore};
export type {ScoreBreakdown};
