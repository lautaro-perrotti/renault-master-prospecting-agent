import type {DiscoveryProvider,DiscoveryResult} from './types.js';
import {QueryGenerator} from './query-generator.js';
import {SearchPlanner,type DiscoveryObjective,type SearchStrategy} from './planner.js';
export type ProviderExecution={provider:string;query:string;status:'SUCCESS'|'ERROR';results:DiscoveryResult[];error?:string};
export class DiscoveryEngine{
  constructor(private providers:DiscoveryProvider[],private queries:QueryGenerator,private planner=new SearchPlanner()){}
  async run(location:string,custom?:string){return(await this.runDetailed(location,custom)).results}
  async runDetailed(location:string,custom?:string,objective?:Partial<DiscoveryObjective>):Promise<{results:DiscoveryResult[];executions:ProviderExecution[];strategies:SearchStrategy[];stopReason:string}>{
    const target:DiscoveryObjective={location,goal:'find refrigerated transport opportunities',maxSearchRequests:24,maxNewCompanies:100,maxRuntimeSeconds:60,minMarginalNovelty:0.1,...objective};
    let strategies:SearchStrategy[]=custom?[{name:'USER',query:custom,provider:'web',reason:'user supplied'}]:this.planner.bootstrap(target);const results:DiscoveryResult[]=[];const executions:ProviderExecution[]=[];const started=Date.now();let requests=0;const seen=new Set<string>();
    const runStrategy=async(strategy:SearchStrategy)=>{const selected=custom?this.providers:this.providers.filter(provider=>strategy.provider==='places'?provider.name==='google-places':strategy.provider==='social'?provider.name==='social-search':provider.name==='brave-search');for(const provider of selected){if(requests>=target.maxSearchRequests||results.length>=target.maxNewCompanies)return;requests++;try{const found=await provider.search(strategy.query,location);const novel=found.filter(x=>{const key=`${provider.name}|${x.sourceUrl}`;if(seen.has(key))return false;seen.add(key);return true});results.push(...novel);executions.push({provider:provider.name,query:strategy.query,status:'SUCCESS',results:novel})}catch(error){executions.push({provider:provider.name,query:strategy.query,status:'ERROR',results:[],error:error instanceof Error?error.message:String(error)})}}};
    for(const strategy of [...strategies]){if(requests>=target.maxSearchRequests)return{results,executions,strategies,stopReason:'REQUEST_BUDGET'};if((Date.now()-started)/1000>=target.maxRuntimeSeconds)return{results,executions,strategies,stopReason:'TIME_BUDGET'};await runStrategy(strategy)}
    if(!custom&&results.length&&requests<target.maxSearchRequests){const signals=results.flatMap(result=>[result.name,String(result.metadata.description??'')]);const derived=this.planner.derive(target,signals,strategies.map(strategy=>strategy.query));strategies=[...strategies,...derived];for(const strategy of derived){if(requests>=target.maxSearchRequests)break;const before=results.length;await runStrategy(strategy);if(before===results.length&&derived.indexOf(strategy)>2)break}}
    return{results,executions,strategies,stopReason:requests>=target.maxSearchRequests?'REQUEST_BUDGET':results.length>=target.maxNewCompanies?'COMPANY_TARGET':'EXHAUSTED'};
  }
  adaptiveStrategies(location:string,signals:string[],seenQueries:string[]){return this.planner.derive({location,goal:'',maxSearchRequests:1,maxNewCompanies:1,maxRuntimeSeconds:1,minMarginalNovelty:0},signals,seenQueries)}
}
