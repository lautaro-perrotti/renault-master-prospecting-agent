import {createHash} from 'node:crypto';
export type DiscoveryObjective={id?:string;location:string;goal:string;maxSearchRequests:number;maxNewCompanies:number;maxRuntimeSeconds:number;minMarginalNovelty:number};
export type SearchStrategy={name:string;query:string;provider:'places'|'web'|'social';reason:string};
const bootstrap=['distribuidora de congelados','distribuidor de alimentos refrigerados','fabrica de helados','lacteos mayorista','frigorifico','mayorista gastronomico','catering viandas','logistica refrigerada'];
export class SearchPlanner{
  constructor(private readonly coverage='CABA,GBA,AMBA'){}
  bootstrap(objective:DiscoveryObjective):SearchStrategy[]{return bootstrap.map(query=>({name:'BOOTSTRAP',query:`${query} ${objective.location}`,provider:query.includes('logistica')?'web':'places',reason:'bootstrap vocabulary'} as SearchStrategy))}
  derive(objective:DiscoveryObjective,signals:string[],seenQueries:string[]=[]):SearchStrategy[]{const terms=[...new Set(signals.flatMap(signal=>signal.toLowerCase().match(/[a-z]{5,}/gi)??[]))].filter(term=>!['empresa','productos','servicios','distribucion','publica'].includes(term));return terms.slice(0,8).map(term=>({name:'DERIVED',query:`${term} ${objective.location} ${this.coverage}`,provider:'web',reason:`vocabulary observed in evidence: ${term}`} as SearchStrategy)).filter(x=>!seenQueries.includes(x.query))}
  fingerprint(strategy:SearchStrategy){return createHash('sha256').update(`${strategy.provider}|${strategy.query}`).digest('hex')}
}
