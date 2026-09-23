import {createHash} from 'node:crypto';
export type DiscoveryObjective={id?:string;location:string;goal:string;maxSearchRequests:number;maxNewCompanies:number;maxRuntimeSeconds:number;minMarginalNovelty:number};
export type SearchStrategy={name:string;query:string;provider:'places'|'web'|'social';reason:string};
export const BOOTSTRAP_SEEDS=['distribuciÃ³n mayorista CABA','empresas con reparto AMBA','reposiciÃ³n diaria comercios Zona Norte','fleteros vehÃ­culo propio AMBA','logÃ­stica urbana CABA','distribuciÃ³n HORECA AMBA','transporte refrigerado AMBA','productos congelados AMBA'];
export class SearchPlanner{
  constructor(private readonly coverage='CABA,GBA,AMBA'){}
  bootstrap(objective:DiscoveryObjective):SearchStrategy[]{return BOOTSTRAP_SEEDS.map(query=>({name:'BOOTSTRAP',query:`${query} ${objective.location}`,provider:/refrigerado|congelados/i.test(query)?'web':'places',reason:'bootstrap vocabulary'} as SearchStrategy))}
  derive(objective:DiscoveryObjective,signals:string[],seenQueries:string[]=[]):SearchStrategy[]{const terms=[...new Set(signals.flatMap(signal=>signal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{5,}/g)??[]))].filter(term=>!['empresa','productos','servicios','publica','actividad'].includes(term));return terms.slice(0,8).map(term=>({name:'DERIVED',query:`${term} ${objective.location} ${this.coverage}`,provider:'web',reason:`vocabulary observed in evidence: ${term}`} as SearchStrategy)).filter(x=>!seenQueries.includes(x.query))}
  fingerprint(strategy:SearchStrategy){return createHash('sha256').update(`${strategy.provider}|${strategy.query}`).digest('hex')}
}
