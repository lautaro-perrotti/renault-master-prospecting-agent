import {createHash} from 'node:crypto';
export type DiscoveryObjective={id?:string;location:string;goal:string;maxSearchRequests:number;maxNewCompanies:number;maxRuntimeSeconds:number;minMarginalNovelty:number};
export type SearchStrategy={name:string;query:string;provider:'places'|'web'|'social';reason:string};
export const BOOTSTRAP_SEEDS=['distribuidores de alimentos con entregas','mayoristas de alimentos reparto','proveedor HORECA entrega','productos congelados entregas','distribuidores de lacteos reparto','frutas y verduras mayorista entrega','importador de alimentos entrega comercios','ecommerce entregas propias','buscamos fleteros vehiculo propio','proveedores de transporte AMBA','nuevas zonas de entrega alimentos'];
export class SearchPlanner{
  constructor(private readonly coverage='CABA,GBA,AMBA'){}
  bootstrap(objective:DiscoveryObjective):SearchStrategy[]{return BOOTSTRAP_SEEDS.map((seed,index)=>({name:'BOOTSTRAP',query:`${seed} ${objective.location}`,provider:index%3===0?'web':'places',reason:'sector and external-demand vocabulary'} as SearchStrategy))}
  derive(objective:DiscoveryObjective,signals:string[],seenQueries:string[]=[]):SearchStrategy[]{const terms=[...new Set(signals.flatMap(signal=>signal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{5,}/g)??[]))].filter(term=>!['empresa','productos','servicios','publica','actividad','logistica','transporte','distribucion'].includes(term));return terms.slice(0,8).map(term=>({name:'DERIVED',query:`${term} ${objective.location} ${this.coverage}`,provider:'web',reason:`vocabulary observed in evidence: ${term}`} as SearchStrategy)).filter(x=>!seenQueries.includes(x.query))}
  fingerprint(strategy:SearchStrategy){return createHash('sha256').update(`${strategy.provider}|${strategy.query}`).digest('hex')}
}
