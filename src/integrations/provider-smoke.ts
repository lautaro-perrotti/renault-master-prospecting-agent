import 'dotenv/config';
import {loadConfig} from '../config.js';
import {BraveSearchProvider} from '../discovery/brave-search.js';
import {GooglePlacesDiscoveryProvider} from '../discovery/google-places.js';
import {OpenAIResearchProvider} from '../qualification/ai-research.js';

const config=loadConfig();
const provider=process.argv[2];
function output(value:Record<string,unknown>){console.log(JSON.stringify(value,null,2))}
async function main(){
  if(provider==='brave'){
    if(!config.BRAVE_SEARCH_API_KEY)return output({provider:'Brave',status:'NOT_CONFIGURED'});
    const results=await new BraveSearchProvider(config).search('empresas con reparto','AMBA');return output({provider:'Brave',status:'REAL_API_VALIDATED',results:results.slice(0,5).map(result=>({name:result.name,sourceUrl:result.sourceUrl}))});
  }
  if(provider==='places'){
    if(!config.GOOGLE_MAPS_API_KEY)return output({provider:'Google Places',status:'NOT_CONFIGURED'});
    const results=await new GooglePlacesDiscoveryProvider(config).search('distribución mayorista','CABA');return output({provider:'Google Places',status:'REAL_API_VALIDATED',results:results.slice(0,5).map(result=>({name:result.name,externalId:result.externalId,address:result.address}))});
  }
  if(provider==='openai'){
    if(!config.OPENAI_API_KEY)return output({provider:'OpenAI',status:'NOT_CONFIGURED'});
    const result=await new OpenAIResearchProvider(config).research({company:'Empresa de distribución de ejemplo',evidence:[{id:'SMOKE_E1',excerpt:'Distribución mayorista con reparto recurrente en AMBA.'}]});return output({provider:'OpenAI',status:'REAL_API_VALIDATED',summary:result.summary,useCase:result.useCase,refrigerationFit:result.refrigerationFit,evidenceIds:result.evidenceIds});
  }
  throw new Error('USAGE: provider-smoke brave|places|openai');
}
main().catch(error=>{console.error(JSON.stringify({status:'ERROR',error:error instanceof Error?error.message:String(error)}));process.exitCode=1});
